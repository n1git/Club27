import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export interface RepoMigration {
  version: string;
  name: string;
  file: string;
}

let client: postgres.Sql | null = null;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur");
  client ??= postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 15 });
  return client;
}

export async function repoMigrations(): Promise<RepoMigration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return files.map((file) => ({ version: file.slice(0, 14), name: file.slice(15, -4), file }));
}

async function appliedRows() {
  return db()<{ version: string; name: string | null }[]>`select version, name from supabase_migrations.schema_migrations`;
}

function isApplied(m: RepoMigration, rows: { version: string; name: string | null }[]) {
  return rows.some((r) => r.version === m.version || r.name === m.name);
}

export async function migrationStatus() {
  const [repo, rows] = await Promise.all([repoMigrations(), appliedRows()]);
  return repo.map((m) => ({ version: m.version, name: m.name, applied: isApplied(m, rows) }));
}

async function findPending(version: string) {
  const [repo, rows] = await Promise.all([repoMigrations(), appliedRows()]);
  const index = repo.findIndex((m) => m.version === version);
  if (index === -1) throw new Error(`Migrasi ${version} tidak ada di repo`);
  const target = repo[index];
  if (isApplied(target, rows)) throw new Error(`Migrasi ${target.file} sudah tercatat`);
  const earlier = repo.slice(0, index).filter((m) => !isApplied(m, rows));
  return { target, earlier };
}

export async function applyMigration(version: string) {
  const { target, earlier } = await findPending(version);
  if (earlier.length) {
    throw new Error(`Terapkan dulu migrasi sebelumnya: ${earlier.map((m) => m.file).join(", ")}`);
  }
  const content = await readFile(path.join(MIGRATIONS_DIR, target.file), "utf8");
  await db().begin(async (tx) => {
    await tx.unsafe(content);
    await tx`insert into supabase_migrations.schema_migrations (version, name) values (${target.version}, ${target.name})`;
  });
  return target.file;
}

export async function markMigrationApplied(version: string) {
  const { target } = await findPending(version);
  await db()`insert into supabase_migrations.schema_migrations (version, name) values (${target.version}, ${target.name})`;
  return target.file;
}
