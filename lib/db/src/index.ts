import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import * as schema from './schema';
export const localDatabase = process.env.DATABASE_MODE === 'local' ? new PGlite(process.env.LOCAL_DATABASE_PATH || '.data/postgres') : null;
if (!localDatabase && !process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL ou DATABASE_MODE=local no .env.');
export const pool = localDatabase ? null : new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db: NodePgDatabase<typeof schema> = localDatabase ? localDrizzle(localDatabase, { schema }) as unknown as NodePgDatabase<typeof schema> : drizzle(pool!, { schema });
export async function executeSQL(sql: string) { if (localDatabase) return localDatabase.exec(sql); return pool!.query(sql); }
export async function closeDatabase() { if (localDatabase) await localDatabase.close(); else await pool!.end(); }
export * from './schema';
