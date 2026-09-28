import type { Migracao } from "../migrationRunner.js";

/** Id do único negócio existente hoje — mesmo id usado pra semear a tabela abaixo. */
export const ID_NEGOCIO_SEED = "barba-e-oficio";

// Snapshot congelado do que hoje vive em domain/services.ts e
// domain/businessHours.ts. Uma migração nunca deve importar código da
// aplicação (que pode mudar depois) — o valor certo aqui é o valor de hoje,
// copiado, não uma referência que se atualiza sozinha.
const CATALOGO_SERVICOS_SEED = JSON.stringify([
  { id: "corte", nome: "Corte clássico", duracaoMin: 40, precoCentavos: 4500 },
  { id: "degrade", nome: "Degradê", duracaoMin: 45, precoCentavos: 5000 },
  { id: "barba", nome: "Barba na navalha", duracaoMin: 30, precoCentavos: 4000 },
  { id: "combo", nome: "Corte + Barba", duracaoMin: 70, precoCentavos: 7500 },
  { id: "sobrancelha", nome: "Sobrancelha", duracaoMin: 15, precoCentavos: 1500 },
  { id: "pezinho", nome: "Acabamento (pézinho)", duracaoMin: 15, precoCentavos: 1500 },
]);

const HORARIO_FUNCIONAMENTO_SEED = JSON.stringify({
  0: null,
  1: null,
  2: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 },
  3: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 },
  4: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 },
  5: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 },
  6: { abreHora: 8, abreMinuto: 0, fechaHora: 17, fechaMinuto: 0 },
});

/**
 * Introduz a tabela `negocios` — fundação pro multi-tenant (várias empresas,
 * cada uma com seu WhatsApp, na mesma instância) — e semeia o negócio único
 * de hoje ("Barba & Ofício") com os valores que hoje estão hardcoded no
 * domínio, pra preservar o comportamento atual quando o resto do sistema
 * passar a ler daqui em vez das constantes em TypeScript.
 *
 * `negocio_id` em `clientes`/`agendamentos` é adicionado como coluna nova e
 * retroativamente preenchido pro negócio seedado. De propósito NÃO troca a
 * constraint `UNIQUE` de `clientes.telefone` pra `UNIQUE(negocio_id,
 * telefone)` ainda — o SQLite exige recriar a tabela pra isso, e enquanto só
 * existir um negócio a constraint atual é inofensiva. Essa troca fica pra
 * quando um segundo negócio de verdade for provisionado, junto da mudança
 * que vai de fato depender disso.
 */
export const migracao0002NegociosMultiTenant: Migracao = {
  id: "0002_negocios_multi_tenant",
  up(db) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE negocios (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          ativo INTEGER NOT NULL DEFAULT 1,
          whatsapp_auth_dir TEXT NOT NULL,
          numeros_admin TEXT NOT NULL DEFAULT '',
          antecedencia_minima_cancelamento_horas INTEGER NOT NULL DEFAULT 2,
          janela_agendamento_dias INTEGER NOT NULL DEFAULT 14,
          catalogo_servicos TEXT NOT NULL,
          horario_funcionamento TEXT NOT NULL,
          criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      db.prepare(
        `INSERT INTO negocios (
          id, nome, ativo, whatsapp_auth_dir, numeros_admin,
          antecedencia_minima_cancelamento_horas, janela_agendamento_dias,
          catalogo_servicos, horario_funcionamento
        ) VALUES (?, ?, 1, ?, ?, 2, 14, ?, ?)`,
      ).run(
        ID_NEGOCIO_SEED,
        "Barba & Ofício",
        process.env.WHATSAPP_AUTH_DIR ?? "./data/auth",
        process.env.ADMIN_PHONE_NUMBERS ?? "",
        CATALOGO_SERVICOS_SEED,
        HORARIO_FUNCIONAMENTO_SEED,
      );

      db.exec(`ALTER TABLE clientes ADD COLUMN negocio_id TEXT REFERENCES negocios(id)`);
      db.prepare(`UPDATE clientes SET negocio_id = ?`).run(ID_NEGOCIO_SEED);
      db.exec(`CREATE INDEX idx_clientes_negocio_telefone ON clientes(negocio_id, telefone)`);

      db.exec(`ALTER TABLE agendamentos ADD COLUMN negocio_id TEXT REFERENCES negocios(id)`);
      db.prepare(`UPDATE agendamentos SET negocio_id = ?`).run(ID_NEGOCIO_SEED);
      db.exec(`CREATE INDEX idx_agendamentos_negocio_inicio ON agendamentos(negocio_id, inicio)`);
    })();
  },
};
