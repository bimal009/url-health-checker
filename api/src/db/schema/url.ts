import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { urlStatusEnum } from "./enums.js";
import { batchTable } from "./batches.js";


export const urlTable = pgTable("url", {
  id: uuid().primaryKey().defaultRandom(),
  batchId: uuid()
    .notNull()
    .references(() => batchTable.id, { onDelete: "cascade" }),
  url: text().notNull(),
  status: urlStatusEnum().notNull().default("pending"),
  httpStatusCode: integer(),
  responseTimeMs: integer(),
  title: text(),
  attemptCount: integer().notNull().default(0),
  jobId: text(),
  errorMessage: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

