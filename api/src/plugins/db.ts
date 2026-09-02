import fp from "fastify-plugin"
import { db } from "../db/db"

export const dbPlugin = fp(async (fastify) => {
  fastify.decorate("db", db)
})