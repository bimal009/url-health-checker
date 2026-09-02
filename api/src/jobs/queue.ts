import { Queue } from "bullmq"
import { bullMqConnection } from "../lib/bullmq-connection"
import { UrlCheckJobData } from "@task/types"

export const urlCheckQueue = new Queue<UrlCheckJobData>("url-checks", {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
})