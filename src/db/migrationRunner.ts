import type { Database } from "better-sqlite3";

export interface Migracao {
  id: string;
  up: (db: Database) => void;
}

/**
 * Runner de migrações caseiro (sem dependência nova): cada migração roda no
 * máximo uma vez, registrada em `schema_migrations`, na ordem em que aparece
 * na lista. Cada `up(db)` decide sua própria transação — necessário porque
 * algumas migrações precisam alternar `PRAGMA foreign_keys`, que o SQLite só
 * aceita mudar fora de uma transação em andamento.
 */
export function aplicarMigracoes(db: Database, migracoes: readonly Migracao[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const jaAplicadas = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((linha) => linha.id),
  );

  for (const migracao of migracoes) {
    if (jaAplicadas.has(migracao.id)) continue;
    migracao.up(db);
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(migracao.id);
  }
}
