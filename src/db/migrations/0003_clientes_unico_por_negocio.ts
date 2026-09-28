import type { Migracao } from "../migrationRunner.js";

/**
 * Corrige `clientes.telefone` de `UNIQUE` global pra `UNIQUE(negocio_id,
 * telefone)` — o mesmo telefone agora pode ser cliente de dois negócios
 * diferentes. O SQLite não permite alterar uma constraint inline via ALTER
 * TABLE, então recria a tabela (padrão consagrado: cria `_novo`, copia,
 * dropa, renomeia). `agendamentos` também precisa ser recriada: ela tinha
 * uma FK pra `clientes(telefone)`, que só é válida enquanto `telefone`
 * sozinho for indexado como único — deixa de ser depois desta migração.
 * Essa FK nunca foi usada pra cascade ou join no código, então é descartada
 * sem substituto.
 *
 * Só é seguro esperar `negocio_id` sempre preenchido (NOT NULL) a partir
 * daqui porque a migração 0002 já fez o backfill em todas as linhas
 * existentes.
 */
export const migracao0003ClientesUnicoPorNegocio: Migracao = {
  id: "0003_clientes_unico_por_negocio",
  up(db) {
    const fkEstavaAtivo = db.pragma("foreign_keys", { simple: true }) === 1;
    if (fkEstavaAtivo) db.pragma("foreign_keys = OFF");

    db.transaction(() => {
      db.exec(`
        CREATE TABLE clientes_novo (
          id TEXT PRIMARY KEY,
          negocio_id TEXT NOT NULL REFERENCES negocios(id),
          telefone TEXT NOT NULL,
          nome TEXT,
          criado_em TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (negocio_id, telefone)
        );
      `);
      db.exec(`
        INSERT INTO clientes_novo (id, negocio_id, telefone, nome, criado_em)
        SELECT id, negocio_id, telefone, nome, criado_em FROM clientes;
      `);
      db.exec(`DROP TABLE clientes`);
      db.exec(`ALTER TABLE clientes_novo RENAME TO clientes`);

      db.exec(`
        CREATE TABLE agendamentos_novo (
          id TEXT PRIMARY KEY,
          negocio_id TEXT NOT NULL REFERENCES negocios(id),
          telefone TEXT NOT NULL,
          servico TEXT NOT NULL,
          inicio TEXT NOT NULL,
          fim TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'confirmado',
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`
        INSERT INTO agendamentos_novo (id, negocio_id, telefone, servico, inicio, fim, status, criado_em)
        SELECT id, negocio_id, telefone, servico, inicio, fim, status, criado_em FROM agendamentos;
      `);
      db.exec(`DROP TABLE agendamentos`);
      db.exec(`ALTER TABLE agendamentos_novo RENAME TO agendamentos`);
      db.exec(`CREATE INDEX idx_agendamentos_negocio_inicio ON agendamentos(negocio_id, inicio)`);
      db.exec(`CREATE INDEX idx_agendamentos_telefone_status ON agendamentos(telefone, status)`);
    })();

    if (fkEstavaAtivo) db.pragma("foreign_keys = ON");
  },
};
