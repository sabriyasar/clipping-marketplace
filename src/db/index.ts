import path from "node:path";
import { config } from "dotenv";

// .env.local varsa öncelikli yüklenir (Next.js davranışıyla aynı önceliği taklit eder).
// dotenv, process.env'de zaten var olan key'lerin üzerine yazmaz (override:false varsayılan),
// bu yüzden altta .env'i yüklemek sadece eksik key'leri tamamlar, .env.local'ı ezmez.
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, {
  schema,
});
