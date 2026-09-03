import fp from "fastify-plugin"
import { db, pool } from "../db/db"

export const dbPlugin = fp(async (fastify) => {
  fastify.decorate("db", db)
  fastify.addHook("onClose", async () => {
    await pool.end()
  })
})
