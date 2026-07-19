import Database from "better-sqlite3";
import type { z } from "zod";

/**
 * Camada de persistência do Super Construtor. Cada entidade do canon vira
 * uma tabela com uma linha por registro: `id` indexado + `data` (JSON do
 * objeto validado pelo schema). Suficiente para CRUD real (não
 * `localStorage`) sem amarrar o v0 a um esquema relacional coluna a coluna —
 * consultas relacionais (ex.: squads de uma company) evoluem na Etapa 4
 * quando o formato de Pack e o `findOrCreate` exigirem.
 */

export const TABLES = [
  "agents",
  "squads",
  "companies",
  "mind_clones",
  "providers",
  "tasks",
  "runs",
  "approvals",
  "learning_flows",
  "memory_chunks",
  "canvas_nodes",
  "canvas_edges",
] as const;
export type TableName = (typeof TABLES)[number];

export function openDatabase(path: string = ":memory:"): Database.Database {
  const db = new Database(path);
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function migrate(db: Database.Database): void {
  for (const table of TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  }
}

export interface Repository<T extends { id: string }> {
  insert(entity: unknown): T;
  getById(id: string): T | undefined;
  list(): T[];
  update(id: string, patch: Record<string, unknown>): T | undefined;
  remove(id: string): boolean;
}

export function createRepository<T extends { id: string }>(
  db: Database.Database,
  table: TableName,
  schema: z.ZodType<T>,
): Repository<T> {
  const upsertStmt = db.prepare(`
    INSERT INTO ${table} (id, data) VALUES (@id, @data)
    ON CONFLICT(id) DO UPDATE SET data = @data, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);
  const getStmt = db.prepare(`SELECT data FROM ${table} WHERE id = ?`);
  const listStmt = db.prepare(`SELECT data FROM ${table} ORDER BY created_at ASC`);
  const deleteStmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);

  function readRow(row: { data: string } | undefined): T | undefined {
    return row ? schema.parse(JSON.parse(row.data)) : undefined;
  }

  const repo: Repository<T> = {
    insert(entity) {
      const parsed = schema.parse(entity);
      upsertStmt.run({ id: parsed.id, data: JSON.stringify(parsed) });
      return parsed;
    },
    getById(id) {
      return readRow(getStmt.get(id) as { data: string } | undefined);
    },
    list() {
      const rows = listStmt.all() as { data: string }[];
      return rows.map((row) => schema.parse(JSON.parse(row.data)));
    },
    update(id, patch) {
      const existing = repo.getById(id);
      if (!existing) return undefined;
      const merged = schema.parse({ ...existing, ...patch });
      upsertStmt.run({ id: merged.id, data: JSON.stringify(merged) });
      return merged;
    },
    remove(id) {
      const result = deleteStmt.run(id);
      return result.changes > 0;
    },
  };
  return repo;
}
