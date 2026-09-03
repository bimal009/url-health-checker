import "dotenv/config"

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: required("REDIS_URL"),
  WEB_URL: process.env.WEB_URL ?? "http://localhost:3000",
  PORT: Number(process.env.PORT) || 8080,
}
