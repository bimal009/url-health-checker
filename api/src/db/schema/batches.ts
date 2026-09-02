import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { batchStatusEnum } from "./enums.js";

export const batchTable = pgTable("batch", {
  id: uuid().primaryKey().defaultRandom(),
  status: batchStatusEnum().notNull().default("pending"),
  totalUrls: integer().notNull().default(0),
  completedCount: integer().notNull().default(0),
  successCount: integer().notNull().default(0),
  failedCount: integer().notNull().default(0),
  eventSeq: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
