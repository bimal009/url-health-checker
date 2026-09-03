import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../lib/env";
import { relations } from "./schema/relations";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const db = drizzle({ client: pool, relations });

export { db, pool };
export type DB = typeof db;
