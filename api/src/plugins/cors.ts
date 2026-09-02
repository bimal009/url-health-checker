import fp from "fastify-plugin"
import cors from "@fastify/cors"

export const corsPlugin = fp(async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    methods: ["GET", "POST", "PATCH"],
  })
})