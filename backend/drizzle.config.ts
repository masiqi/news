import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "d1-http",
  dialect: "sqlite",
  dbCredentials: {
    wranglerConfigPath: "wrangler.jsonc",
  },
} satisfies Config;