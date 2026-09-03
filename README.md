# URL Health Checker

Submit a batch of URLs (paste or CSV upload). Each URL is checked in the background, and the
batch page streams live progress. Supports cancel and retry-failed-only.

## Stack

- **api**: Fastify and Zod, Postgres via Drizzle ORM, BullMQ (Redis) for the job queue
- **worker**: a separate process, a BullMQ Worker consuming the same queue
- **web**: Next.js (App Router), server-rendered batch pages plus SSE for live updates
- **types**: shared Zod schemas and types imported by both api and web

## Run the whole system

Requires Node 20+, pnpm, and Docker.

```bash
pnpm install
docker compose up -d       # starts Postgres and Redis
```

Copy `api/.env.example` to `api/.env` and `web/.env.example` to `web/.env.local`, filling in the
values (the defaults match the docker-compose services if you're running them locally).

```bash
pnpm db:migrate            # applies Drizzle migrations
pnpm dev                   # starts api, worker, and web together
```

- web: http://localhost:3000
- api: http://localhost:8080 (health check at `GET /health`)

To exercise the multi-process guarantees, start extra workers in additional terminals:

```bash
pnpm dev:worker
```

Individual processes are also available separately: `pnpm dev:api`, `pnpm dev:worker`,
`pnpm dev:web`.

## Architecture

### How it works, end to end

A user pastes URLs or uploads a CSV on the batches page. The frontend parses that input into a
plain list of strings and sends it to `POST /batches`. The API validates the list, then in a
single Postgres transaction inserts one batch row and one row per URL, all starting as pending.
Only after that transaction commits does the API enqueue one BullMQ job per URL, each carrying
the URL's id and the URL itself. The response is just `{ batchId }`, which the client uses to
navigate to `/batches/:id`.

That detail page is server-rendered first, reading the batch's current state directly from
Postgres, so opening it in a fresh tab always shows correct state immediately, whether the batch
is still running or already finished. If the batch isn't finished yet, the page then opens an SSE
connection to receive live updates as they happen.

Meanwhile, separately, one or more worker processes are pulling jobs off the same BullMQ queue.
For each job, a worker checks the global rate limit, checks whether the batch has been cancelled,
performs the actual HTTP request to the target URL, records the result in Postgres, and publishes
a notification over Redis pub/sub. The SSE endpoint the browser is connected to receives that
notification, re-reads the batch's current full state from Postgres, and pushes it down to the
browser. The browser replaces its local state with whatever it receives, so the progress bar and
per-URL rows update without the user doing anything.

Cancel and retry both follow the same shape: change the relevant rows in Postgres inside a
transaction, then either remove queued jobs from BullMQ or enqueue new ones as needed. The worker
never has to be told directly that a cancel happened; it just checks the batch's status in
Postgres before and after doing the actual work.

### Submission

`POST /batches` inserts the batch row and every URL row in one transaction, then enqueues one
BullMQ job per URL. Nothing is checked until the rows are persisted. The response gives the
client just enough to track the batch (its id); the client navigates to `/batches/:id`, which
server-renders the full state from Postgres.

### Background processing

**Global rate limit (10 requests per second)**: a Redis Lua script (`api/src/lib/rate-limit.ts`)
maintains one sliding window sorted set under a single fixed key. Every worker in every process
checks it before making a request, so the limit is system-wide. When the limit is hit, the job is
moved to a short delay via `moveToDelayed` and re-run; this does not consume a retry attempt. The
algorithm follows the sliding window log pattern described in Redis's own rate limiting guide:
https://redis.io/tutorials/howtos/ratelimiting/#2-sliding-window-log

**Concurrency (5)**: `Queue.setGlobalConcurrency(5)` is set at worker startup, so 5 is the ceiling
across all worker processes, not per process. Each worker also runs with a local `concurrency: 5`.

**Retries**: BullMQ jobs are configured with 3 attempts and exponential backoff (1000ms base
delay).

**Idempotency**: `processJob` claims a URL with a conditional update, only proceeding if the row's
status is still pending or processing. Settling a URL and incrementing the batch's counters
happens in one transaction, guarded by the same condition. A job redelivered after a worker crash
updates zero rows and is a no-op, so there's no double counting and no stuck batch.

### Redis client usage

Redis is used for four different things in this system, and not all of them can share one client
connection.

The general purpose client (`lib/redis.ts`'s `redis` export) handles the rate limiter's Lua
`EVAL` calls and the batch list cache's `GET`/`SET` calls. It's shared across the app, since none
of these operations change what the connection can do afterward.

BullMQ's `Queue` and `Worker` both connect with `maxRetriesPerRequest: null`, a setting BullMQ
specifically requires because it issues blocking commands internally to wait for new jobs
efficiently, and a finite retry limit can make those blocking calls throw unexpectedly. This is a
separate connection from the general purpose one, so job processing traffic and ordinary
read/write traffic don't share a connection tuned for a different purpose.

Publishing is a normal command (`PUBLISH`), so it runs fine on the shared general purpose client.

Subscribing is the one operation that can't share a connection with anything else. Once a client
calls `SUBSCRIBE`, that connection is locked into subscriber mode and can no longer run
`GET`/`SET`/`EVAL` until it unsubscribes. Each open SSE connection creates its own dedicated
subscriber (`createSubscriber()`) for exactly this reason. Using the shared client here would
break rate limiting and caching for the whole app the moment one browser opened a batch detail
page. Each subscriber is created when its SSE connection opens and disconnected when it closes,
so the number of subscriber connections scales with concurrently open batch detail pages, not
with total traffic.

### Live updates

**Why not polling.** The simplest option is having the browser re-fetch the batch every second or
two. It works, but it's wasteful. Most polls return nothing new, and it puts a floor on latency:
an update is only ever as fresh as the polling interval, and a shorter interval just means more
wasted requests. It also scales badly. N open batch pages means N times some fixed request rate
hitting the API constantly, whether anything changed or not.

**Why not WebSockets.** WebSockets are bidirectional and full duplex, but this system never needs
the client to send anything after the initial connection. The real writes (cancel, retry) already
go through normal POST requests, so bidirectionality here would be unused capability. WebSockets
also don't reconnect on their own. A dropped connection needs hand-written reconnect and backoff
logic in the browser. And a WebSocket server needs its own upgrade handshake and a different set
of infrastructure assumptions, since some proxies and load balancers need explicit configuration
to pass WebSocket traffic through, where SSE is just a long-lived HTTP response.

**Why SSE.** The data only ever flows server to client, which is exactly what SSE is for. The
browser's `EventSource` API reconnects automatically on a dropped connection with no code required
on the client side. And since it's plain HTTP, it passes through typical infrastructure without
special handling.

Workers publish to `batch:<id>:updates` on Redis. The SSE endpoint (`GET /batches/:id/events`)
subscribes and, on each message, re-reads the batch from Postgres and pushes the full state.
Because the transport is Redis pub/sub and the source of truth is Postgres, this is correct
regardless of how many API instances are running. On connect, the endpoint always sends current
state first, so a page refresh or a dropped EventSource connection (which the browser
auto-reconnects) both recover to a complete, correct view.

### Caching

`GET /batches` is served from a 30 second Redis cache. The cache key is deleted whenever a batch
is created, cancelled, retried, transitions to running, or a URL settles, so the list never shows
stale status or progress despite the TTL.

### Cancel and retry

Cancel removes not-yet-started jobs from the queue and flips the batch and all non-terminal URLs
to cancelled in one transaction. In-flight jobs can't be pulled from the queue, so `processJob`
re-checks the batch's status before and after the HTTP check and bails if it's been cancelled;
the settle guard also refuses to write a cancelled row over.

Retry failed only touches rows with status failed. It resets them, adjusts the counters, sets the
batch back to running, and re-enqueues just those URLs. Successful URLs are never re-run.

## Behavior when scaled horizontally

Multiple API instances are stateless. Live updates work because every instance subscribes to the
same Redis channels and reads the same Postgres. The list cache is shared in Redis.

Multiple worker processes also work correctly. The rate limit and concurrency ceiling are both
enforced in Redis (the rate limit key, and `setGlobalConcurrency`), so adding workers increases
throughput only up to those global ceilings. Retries and the queue itself are already shared.

Postgres and Redis are the single points of coordination in this system; both are assumed to be
managed or highly available in a real deployment.

## Trade-offs and what I'd do with more time

The rate limiter is a sliding window log, not a token bucket. Under sustained pressure it can
allow small bursts near window edges. A token bucket implemented as a Lua script would be
smoother.

SSE re-reads the whole batch on every event. This is fine for hundreds of URLs, but for very
large batches I'd send row-level deltas keyed by a per-URL sequence instead of the full document.

There's no auth or multi-tenancy. Every batch is readable by anyone who knows its id.

`getBatches` returns the cached JSON without re-validating it against the schema. I'd parse it
back through the shared Zod schema so a schema change couldn't silently serve a stale shape.

Migrations use a release candidate version of drizzle-kit. I'd pin to a stable line before
production.

Test coverage isn't included here. The idempotency and cancel/retry paths are the ones that most
warrant integration tests against a real Postgres and Redis.

Worker observability is console logging only right now. I'd add structured logs and metrics for
queue depth, check latency, and failure rate.