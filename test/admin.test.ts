import { describe, expect, it } from "vitest";
import { processarComandoAdmin } from "../src/commands/admin.js";
import type { RelatorioPort } from "../src/conversation/ports.js";
import { NEGOCIO_TESTE } from "./fakes/negocioFake.js";

const relatoriosComAgenda: RelatorioPort = {
  async listarResumoDoDia() {
    return [
      { telefone: "5519999999999", servico: "corte", inicio: new Date(2026, 8, 29, 10, 0) },
      { telefone: "5511888888888", servico: "barba", inicio: new Date(2026, 8, 29, 11, 0) },
    ];
  },
};

const relatoriosVazios: RelatorioPort = {
  async listarResumoDoDia() {
    return [];
  },
};

describe("processarComandoAdmin", () => {
  it("/hoje lista os agendamentos do dia", async () => {
    const resposta = await processarComandoAdmin("/hoje", relatoriosComAgenda, NEGOCIO_TESTE.catalogoServicos);
    expect(resposta).toMatch(/agenda de hoje \(2\)/i);
  });

  it("/hoje sem agendamentos avisa que a agenda está vazia", async () => {
    const resposta = await processarComandoAdmin("/hoje", relatoriosVazios, NEGOCIO_TESTE.catalogoServicos);
    expect(resposta).toMatch(/nenhum agendamento/i);
  });

  it("comando desconhecido retorna null (deixa o fluxo normal decidir o que fazer)", async () => {
    expect(await processarComandoAdmin("/xyz", relatoriosComAgenda, NEGOCIO_TESTE.catalogoServicos)).toBeNull();
  });
});
