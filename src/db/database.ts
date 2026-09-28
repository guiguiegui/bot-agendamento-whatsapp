import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRACOES } from "./migrations/index.js";
import { aplicarMigracoes } from "./migrationRunner.js";

/**
 * Abre (criando se preciso) o banco SQLite e garante que o schema está
 * atualizado, aplicando as migrações pendentes (ver migrationRunner.ts).
 * SQLite direto (sem ORM) é uma escolha deliberada aqui: o bot roda numa
 * única instância por cliente, não precisa de outro banco de verdade
 * rodando ao lado, e `better-sqlite3` é síncrono — sem overhead de round-trip
 * de rede por query. Menos peças pra manter no ar numa VPS pequena.
 */
export function abrirBanco(caminhoArquivo: string): Database.Database {
  if (caminhoArquivo !== ":memory:") {
    mkdirSync(dirname(caminhoArquivo), { recursive: true });
  }
  const db = new Database(caminhoArquivo);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  aplicarMigracoes(db, MIGRACOES);
  return db;
}
