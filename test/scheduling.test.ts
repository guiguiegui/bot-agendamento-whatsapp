import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  gerarHorariosCandidatos,
  horariosDisponiveis,
  intervalosSeSobrepoem,
  podeCancelar,
  tentarAgendar,
  type IntervaloAgendado,
} from "../src/domain/scheduling.js";
import { NEGOCIO_TESTE } from "./fakes/negocioFake.js";

const { horarioFuncionamento: HORARIO, janelaAgendamentoDias: JANELA, antecedenciaMinimaCancelamentoHoras: ANTECEDENCIA } =
  NEGOCIO_TESTE;

// Datas fixas de referência (evita testes "flaky" por dependerem do dia atual):
// 2026-09-29 é uma terça-feira (aberto 09h-19h)
// 2026-09-26 é um sábado    (aberto 08h-17h)
// 2026-09-27 é um domingo   (fechado)
const TERCA = (h: number, m: number) => new Date(2026, 8, 29, h, m, 0, 0);
const DOMINGO = (h: number, m: number) => new Date(2026, 8, 27, h, m, 0, 0);
const AGORA_REFERENCIA = new Date(2026, 8, 22, 9, 0, 0, 0); // terça anterior, bem antes de qualquer caso de teste

describe("intervalosSeSobrepoem", () => {
  it("detecta sobreposição parcial", () => {
    const a: IntervaloAgendado = { inicio: TERCA(10, 0), fim: TERCA(10, 40) };
    const b: IntervaloAgendado = { inicio: TERCA(10, 20), fim: TERCA(11, 0) };
    expect(intervalosSeSobrepoem(a, b)).toBe(true);
  });

  it("não considera conflito quando um termina exatamente quando o outro começa", () => {
    const a: IntervaloAgendado = { inicio: TERCA(10, 0), fim: TERCA(10, 40) };
    const b: IntervaloAgendado = { inicio: TERCA(10, 40), fim: TERCA(11, 10) };
    expect(intervalosSeSobrepoem(a, b)).toBe(false);
  });

  it("não considera conflito quando os intervalos são disjuntos", () => {
    const a: IntervaloAgendado = { inicio: TERCA(9, 0), fim: TERCA(9, 30) };
    const b: IntervaloAgendado = { inicio: TERCA(14, 0), fim: TERCA(14, 30) };
    expect(intervalosSeSobrepoem(a, b)).toBe(false);
  });
});

describe("gerarHorariosCandidatos", () => {
  it("retorna vazio em dia fechado (domingo)", () => {
    expect(
      gerarHorariosCandidatos({ horarioFuncionamento: HORARIO, data: DOMINGO(0, 0), duracaoMin: 40 }),
    ).toHaveLength(0);
  });

  it("respeita abertura, fechamento e duração do serviço", () => {
    const candidatos = gerarHorariosCandidatos({
      horarioFuncionamento: HORARIO,
      data: TERCA(0, 0),
      duracaoMin: 40,
      passoMin: 30,
    });
    expect(candidatos.length).toBeGreaterThan(0);

    const primeiro = candidatos[0]!;
    expect(primeiro.getHours()).toBe(9);
    expect(primeiro.getMinutes()).toBe(0);

    for (const inicio of candidatos) {
      const fim = addMinutes(inicio, 40);
      // nenhum candidato pode começar antes da abertura (9h) ou terminar depois do fechamento (19h)
      expect(inicio.getHours()).toBeGreaterThanOrEqual(9);
      expect(fim.getHours() < 19 || (fim.getHours() === 19 && fim.getMinutes() === 0)).toBe(true);
    }
  });
});

describe("horariosDisponiveis", () => {
  it("remove horários que já passaram no dia corrente", () => {
    const agoraNoMeioDoDia = TERCA(13, 0);
    const candidatos = horariosDisponiveis({
      horarioFuncionamento: HORARIO,
      data: TERCA(0, 0),
      duracaoMin: 40,
      agendamentosExistentes: [],
      agora: agoraNoMeioDoDia,
    });
    expect(candidatos.every((h) => h >= agoraNoMeioDoDia)).toBe(true);
    expect(candidatos.some((h) => h.getHours() < 13)).toBe(false);
  });

  it("remove horários que colidem com agendamentos existentes", () => {
    const existentes: IntervaloAgendado[] = [{ inicio: TERCA(10, 0), fim: TERCA(10, 40) }];
    const candidatos = horariosDisponiveis({
      horarioFuncionamento: HORARIO,
      data: TERCA(0, 0),
      duracaoMin: 40,
      agendamentosExistentes: existentes,
      agora: AGORA_REFERENCIA,
    });
    const temConflito = candidatos.some(
      (inicio) => intervalosSeSobrepoem({ inicio, fim: addMinutes(inicio, 40) }, existentes[0]!),
    );
    expect(temConflito).toBe(false);
  });
});

describe("tentarAgendar", () => {
  it("aceita um horário válido, dentro do expediente e sem conflitos", () => {
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: TERCA(10, 0),
      duracaoMin: 40,
      agendamentosExistentes: [],
      agora: AGORA_REFERENCIA,
    });
    expect(resultado.ok).toBe(true);
  });

  it("recusa horário no passado", () => {
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: TERCA(10, 0),
      duracaoMin: 40,
      agendamentosExistentes: [],
      agora: TERCA(11, 0), // "agora" é depois do horário pedido
    });
    expect(resultado).toEqual({ ok: false, motivo: "no_passado" });
  });

  it("recusa horário além da janela de agendamento (14 dias)", () => {
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: addMinutes(AGORA_REFERENCIA, 60 * 24 * 30), // 30 dias à frente
      duracaoMin: 40,
      agendamentosExistentes: [],
      agora: AGORA_REFERENCIA,
    });
    expect(resultado).toEqual({ ok: false, motivo: "fora_da_janela" });
  });

  it("recusa horário em dia fechado", () => {
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: DOMINGO(10, 0),
      duracaoMin: 40,
      agendamentosExistentes: [],
      agora: AGORA_REFERENCIA,
    });
    expect(resultado).toEqual({ ok: false, motivo: "fora_do_horario" });
  });

  it("recusa quando o serviço terminaria depois do fechamento", () => {
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: TERCA(18, 50),
      duracaoMin: 40, // terminaria 19h30, depois do fechamento (19h)
      agendamentosExistentes: [],
      agora: AGORA_REFERENCIA,
    });
    expect(resultado).toEqual({ ok: false, motivo: "fora_do_horario" });
  });

  it("recusa quando colide com um agendamento existente", () => {
    const existentes: IntervaloAgendado[] = [{ inicio: TERCA(10, 0), fim: TERCA(10, 40) }];
    const resultado = tentarAgendar({
      horarioFuncionamento: HORARIO,
      janelaAgendamentoDias: JANELA,
      inicio: TERCA(10, 20),
      duracaoMin: 30,
      agendamentosExistentes: existentes,
      agora: AGORA_REFERENCIA,
    });
    expect(resultado).toEqual({ ok: false, motivo: "conflito_de_horario" });
  });
});

describe("podeCancelar", () => {
  it("permite cancelar com mais de 2h de antecedência", () => {
    const agora = TERCA(10, 0);
    const agendamento = TERCA(13, 0);
    expect(podeCancelar(ANTECEDENCIA, agendamento, agora)).toBe(true);
  });

  it("bloqueia cancelamento em cima da hora", () => {
    const agora = TERCA(10, 0);
    const agendamento = TERCA(11, 0);
    expect(podeCancelar(ANTECEDENCIA, agendamento, agora)).toBe(false);
  });
});
