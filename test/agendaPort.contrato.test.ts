import { beforeEach, describe, expect, it } from "vitest";
import type { AgendaPort } from "../src/conversation/ports.js";
import { AgendaRepositorySqlite } from "../src/db/agendaRepository.js";
import { abrirBanco } from "../src/db/database.js";
import { ID_NEGOCIO_SEED } from "../src/db/migrations/0002_negocios_multi_tenant.js";
import { AgendaPortFake } from "./fakes/agendaPortFake.js";

/**
 * Bateria de testes de contrato: a MESMA bateria roda contra as duas
 * implementações de `AgendaPort` (SQLite real e fake em memória). Garante
 * que elas continuem se comportando de forma equivalente do ponto de vista
 * de quem só depende da interface (o router).
 *
 * Sem isso, nada impede uma das duas implementações mudar de comportamento
 * sem a outra acompanhar — os testes do router continuariam passando (rodam
 * só contra o fake) enquanto o comportamento real diverge silenciosamente.
 */
function testarContratoDoAgendaPort(nome: string, criarPorta: () => AgendaPort): void {
  describe(`AgendaPort — contrato (${nome})`, () => {
    let porta: AgendaPort;

    beforeEach(() => {
      porta = criarPorta();
    });

    it("não lista nada num dia sem agendamentos", async () => {
      expect(await porta.listarAgendamentosDoDia(new Date(2026, 8, 29))).toEqual([]);
    });

    it("cria um agendamento e ele aparece na listagem do dia, com o horário certo", async () => {
      const inicio = new Date(2026, 8, 29, 10, 0);
      const fim = new Date(2026, 8, 29, 10, 40);
      await porta.criarAgendamento({ telefone: "5519999999999", servico: "corte", inicio, fim });

      const doDia = await porta.listarAgendamentosDoDia(inicio);
      expect(doDia).toHaveLength(1);
      expect(doDia[0]?.inicio.toISOString()).toBe(inicio.toISOString());
      expect(doDia[0]?.fim.toISOString()).toBe(fim.toISOString());
    });

    it("listarAgendamentosDoDia não inclui agendamentos de outro dia", async () => {
      await porta.criarAgendamento({
        telefone: "5519999999999",
        servico: "corte",
        inicio: new Date(2026, 8, 30, 10, 0),
        fim: new Date(2026, 8, 30, 10, 40),
      });
      expect(await porta.listarAgendamentosDoDia(new Date(2026, 8, 29))).toEqual([]);
    });

    it("lista só os agendamentos futuros de um telefone específico", async () => {
      const telefone = "5519999999999";
      const outroTelefone = "5511888888888";
      const agora = new Date(2026, 8, 29, 9, 0);

      const { id: futuroId } = await porta.criarAgendamento({
        telefone,
        servico: "corte",
        inicio: new Date(2026, 8, 29, 10, 0),
        fim: new Date(2026, 8, 29, 10, 40),
      });
      await porta.criarAgendamento({
        telefone,
        servico: "barba",
        inicio: new Date(2026, 8, 28, 10, 0), // passado — não deve aparecer
        fim: new Date(2026, 8, 28, 10, 30),
      });
      await porta.criarAgendamento({
        telefone: outroTelefone,
        servico: "corte",
        inicio: new Date(2026, 8, 29, 11, 0),
        fim: new Date(2026, 8, 29, 11, 40),
      });

      const futuros = await porta.listarAgendamentosFuturosDoCliente(telefone, agora);
      expect(futuros).toHaveLength(1);
      expect(futuros[0]?.id).toBe(futuroId);
    });

    it("busca um agendamento existente por id", async () => {
      const { id } = await porta.criarAgendamento({
        telefone: "5519999999999",
        servico: "combo",
        inicio: new Date(2026, 8, 29, 10, 0),
        fim: new Date(2026, 8, 29, 11, 10),
      });

      const encontrado = await porta.buscarAgendamentoPorId(id);
      expect(encontrado).not.toBeNull();
      expect(encontrado?.servico).toBe("combo");
    });

    it("retorna null ao buscar um id que não existe", async () => {
      expect(await porta.buscarAgendamentoPorId("id-que-nao-existe")).toBeNull();
    });

    it("depois de cancelar, o agendamento não aparece mais em nenhuma consulta", async () => {
      const telefone = "5519999999999";
      const inicio = new Date(2026, 8, 29, 10, 0);
      const { id } = await porta.criarAgendamento({
        telefone,
        servico: "corte",
        inicio,
        fim: new Date(2026, 8, 29, 10, 40),
      });

      await porta.cancelarAgendamento(id);

      expect(await porta.buscarAgendamentoPorId(id)).toBeNull();
      expect(await porta.listarAgendamentosDoDia(inicio)).toEqual([]);
      expect(await porta.listarAgendamentosFuturosDoCliente(telefone, new Date(2026, 8, 29, 9, 0))).toEqual([]);
    });

    it("cancelar um id que não existe não lança erro", async () => {
      await expect(porta.cancelarAgendamento("id-que-nao-existe")).resolves.toBeUndefined();
    });
  });
}

testarContratoDoAgendaPort("fake em memória", () => new AgendaPortFake());
testarContratoDoAgendaPort("SQLite real", () => new AgendaRepositorySqlite(abrirBanco(":memory:"), ID_NEGOCIO_SEED));
