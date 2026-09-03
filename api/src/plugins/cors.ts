import fp from "fastify-plugin"
import cors from "@fastify/cors"
import { env } from "../lib/env"

export const corsPlugin = fp(async (fastify) => {
  await fastify.register(cors, {
    origin: env.WEB_URL,
    methods: ["GET", "POST"],
  })
})
