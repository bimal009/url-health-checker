import { pgEnum } from "drizzle-orm/pg-core";

export const batchStatusEnum = pgEnum("batch_status", [
  "pending",
  "running",
  "completed",
  "cancelled",
]);

export const urlStatusEnum = pgEnum("url_status", [
  "pending",
  "processing",
  "success",
  "failed",
  "cancelled",
]);
