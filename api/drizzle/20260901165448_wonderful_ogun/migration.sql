CREATE TYPE "batch_status" AS ENUM('pending', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "url_status" AS ENUM('pending', 'processing', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"status" "batch_status" DEFAULT 'pending'::"batch_status" NOT NULL,
	"totalUrls" integer DEFAULT 0 NOT NULL,
	"completedCount" integer DEFAULT 0 NOT NULL,
	"successCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"eventSeq" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "url" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"batchId" uuid NOT NULL,
	"url" text NOT NULL,
	"status" "url_status" DEFAULT 'pending'::"url_status" NOT NULL,
	"httpStatusCode" integer,
	"responseTimeMs" integer,
	"title" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"eventSeq" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "url" ADD CONSTRAINT "url_batchId_batch_id_fkey" FOREIGN KEY ("batchId") REFERENCES "batch"("id") ON DELETE CASCADE;