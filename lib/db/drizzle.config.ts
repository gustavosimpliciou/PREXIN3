import { defineConfig } from "drizzle-kit";
import path from "path";



export default defineConfig({
  out: "./migrations",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost/nativos",
  },
});
