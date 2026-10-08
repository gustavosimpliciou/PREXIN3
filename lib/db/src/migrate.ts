import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { db, executeSQL, closeDatabase } from './index';
import { sql } from 'drizzle-orm';
export async function migrate() {
  await executeSQL('CREATE TABLE IF NOT EXISTS nativos_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const name of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) {
    const result = await db.execute(sql`SELECT name FROM nativos_migrations WHERE name = ${name}`);
    if (result.rows.length) continue;
    const statements = (await readFile(`${dir}/${name}`, 'utf8')).split('--> statement-breakpoint');
    await db.transaction(async tx=>{ for (const statement of statements) if (statement.trim()) await tx.execute(sql.raw(statement)); await tx.execute(sql`INSERT INTO nativos_migrations(name) VALUES(${name})`); });
  }
}
if (process.argv[1]?.replace(/\\/g,'/').endsWith('/migrate.ts')) {
  migrate().then(()=>console.log('Migrações aplicadas.')).finally(closeDatabase);
}
