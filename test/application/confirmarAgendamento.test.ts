import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import { ConfirmarAgendamentoUseCase } from "../../src/application/confirmarAgendamento.js";
import { AgendaPortFake } from "../fakes/agendaPortFake.js";
import { NEGOCIO_TESTE } from "../fakes/negocioFake.js";

// 2026-09-29 09:00 é uma terça-feira, dentro do expediente (09h-19h).
const AGORA = new Date(2026, 8, 29, 9, 0, 0, 0);
const TELEFONE = "5519991234567";
const SERVICO = NEGOCIO_TESTE.catalogoServicos[0]!; // corte, 40min

describe("ConfirmarAgendamentoUseCase", () => {
  it("confirma e persiste o agendamento quando o horário está livre", async () => {
    const porta = new AgendaPortFake();
    const resultado = await new ConfirmarAgendamentoUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      telefone: TELEFONE,
      inicio: AGORA,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(true);
    expect(porta.agendamentos).toHaveLength(1);
    expect(porta.agendamentos[0]?.telefone).toBe(TELEFONE);
  });

  it("recusa por conflito e devolve horários alternativos quando o horário acabou de ser ocupado", async () => {
    const porta = new AgendaPortFake();
    porta.semear({ telefone: "5511000000000", servico: SERVICO.id, inicio: AGORA, fim: addMinutes(AGORA, SERVICO.duracaoMin) });

    const resultado = await new ConfirmarAgendamentoUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      telefone: TELEFONE,
      inicio: AGORA,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toBe("conflito_de_horario");
      expect(resultado.horariosAlternativos.length).toBeGreaterThan(0);
    }
    expect(porta.agendamentos).toHaveLength(1); // só o "roubado", não criou um segundo
  });

  it("recusa por horário já passado", async () => {
    const porta = new AgendaPortFake();
    const bemDepois = addMinutes(AGORA, 5);

    const resultado = await new ConfirmarAgendamentoUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      telefone: TELEFONE,
      inicio: AGORA,
      agora: bemDepois,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("no_passado");
    expect(porta.agendamentos).toHaveLength(0);
  });

  it("recusa por estar fora da janela de agendamento permitida", async () => {
    const porta = new AgendaPortFake();
    const muitoNoFuturo = new Date(2027, 0, 1, 10, 0, 0, 0); // bem além dos 14 dias de janela

    const resultado = await new ConfirmarAgendamentoUseCase(porta).executar({
      negocio: NEGOCIO_TESTE,
      servico: SERVICO,
      telefone: TELEFONE,
      inicio: muitoNoFuturo,
      agora: AGORA,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("fora_da_janela");
  });
});
