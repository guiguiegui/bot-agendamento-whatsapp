import { addMinutes } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { processarMensagem } from "../src/conversation/router.js";
import { CONTEXTO_INICIAL, EstadoConversa, type SessaoContexto } from "../src/conversation/states.js";
import { AgendaPortFake } from "./fakes/agendaPortFake.js";

// 2026-09-29 09:00 é uma terça-feira, dentro do expediente (09h-19h).
const AGORA = new Date(2026, 8, 29, 9, 0, 0, 0);
const TELEFONE = "5519991234567";

describe("processarMensagem — fluxo completo de agendamento", () => {
  let porta: AgendaPortFake;
  let contexto: SessaoContexto;

  beforeEach(() => {
    porta = new AgendaPortFake();
    contexto = CONTEXTO_INICIAL;
  });

  it("leva o cliente do menu até a confirmação, passo a passo", async () => {
    // 1) menu -> escolher "agendar horário"
    let resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.AGENDAR_SERVICO);
    expect(resposta.mensagens[0]).toMatch(/qual serviço/i);
    contexto = resposta.contexto;

    // 2) escolhe o serviço "1" (corte clássico)
    resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.AGENDAR_DATA);
    expect(resposta.contexto.servicoSelecionado).toBe("corte");
    contexto = resposta.contexto;

    // 3) escolhe "hoje"
    resposta = await processarMensagem("hoje", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.AGENDAR_HORARIO);
    expect(resposta.contexto.horariosOferecidos?.length ?? 0).toBeGreaterThan(0);
    expect(resposta.mensagens[0]).toMatch(/horários livres/i);
    contexto = resposta.contexto;

    // 4) escolhe o primeiro horário oferecido
    resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto).toEqual(CONTEXTO_INICIAL);
    expect(resposta.mensagens[0]).toMatch(/agendamento confirmado/i);

    // e o agendamento realmente foi persistido na "porta"
    expect(porta.agendamentos).toHaveLength(1);
    expect(porta.agendamentos[0]?.telefone).toBe(TELEFONE);
    expect(porta.agendamentos[0]?.servico).toBe("corte");
  });

  it("responde com a mensagem padrão quando a opção do menu não existe", async () => {
    const resposta = await processarMensagem("banana", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.MENU);
    expect(resposta.mensagens[0]).toMatch(/não entendi/i);
  });

  it("pede confirmação de novo quando a data não é reconhecida", async () => {
    contexto = { estado: EstadoConversa.AGENDAR_DATA, servicoSelecionado: "corte" };
    const resposta = await processarMensagem("qualquer hora", contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.AGENDAR_DATA);
    expect(resposta.mensagens[0]).toMatch(/não entendi a data/i);
  });

  it("reoferece horários quando o escolhido acabou de ser ocupado por outro cliente", async () => {
    contexto = { estado: EstadoConversa.AGENDAR_SERVICO };
    let resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA); // corte
    resposta = await processarMensagem("hoje", resposta.contexto, TELEFONE, porta, AGORA);
    contexto = resposta.contexto;
    const primeiroHorarioIso = contexto.horariosOferecidos?.[0];
    expect(primeiroHorarioIso).toBeDefined();

    // Simula outro cliente roubando esse horário bem entre a listagem e a confirmação.
    const inicio = new Date(primeiroHorarioIso!);
    porta.semear({ telefone: "5511000000000", servico: "corte", inicio, fim: addMinutes(inicio, 40) });

    resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA);
    // não deve confirmar o agendamento do primeiro cliente nesse horário
    expect(resposta.mensagens[0]).not.toMatch(/agendamento confirmado/i);
    expect(resposta.mensagens[0]).toMatch(/ocupado/i);
    // só o agendamento "roubado" existe, o do fluxo original não foi criado
    expect(porta.agendamentos).toHaveLength(1);
  });

  it("avisa que o horário já passou (não que está 'ocupado') quando o cliente demora pra responder", async () => {
    contexto = { estado: EstadoConversa.AGENDAR_SERVICO };
    let resposta = await processarMensagem("1", contexto, TELEFONE, porta, AGORA); // corte
    resposta = await processarMensagem("hoje", resposta.contexto, TELEFONE, porta, AGORA);
    contexto = resposta.contexto;
    const primeiroHorarioIso = contexto.horariosOferecidos?.[0];
    expect(primeiroHorarioIso).toBeDefined();

    // O cliente demora a responder: "agora" avança pra depois do horário oferecido.
    const bemDepois = addMinutes(new Date(primeiroHorarioIso!), 5);

    resposta = await processarMensagem("1", contexto, TELEFONE, porta, bemDepois);
    expect(resposta.mensagens[0]).not.toMatch(/agendamento confirmado/i);
    expect(resposta.mensagens[0]).not.toMatch(/ocupado/i);
    expect(resposta.mensagens[0]).toMatch(/já passou/i);
    expect(porta.agendamentos).toHaveLength(0);
  });
});

describe("processarMensagem — cancelamento", () => {
  it("cancela quando há antecedência suficiente", async () => {
    const porta = new AgendaPortFake();
    const inicio = addMinutes(AGORA, 60 * 5); // 5h à frente — dentro da mesma janela de horário comercial
    porta.semear({ telefone: TELEFONE, servico: "corte", inicio, fim: addMinutes(inicio, 40) });

    let resposta = await processarMensagem("3", CONTEXTO_INICIAL, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.CANCELAR_ESCOLHER);

    resposta = await processarMensagem("1", resposta.contexto, TELEFONE, porta, AGORA);
    expect(resposta.mensagens[0]).toMatch(/cancelado/i);
    expect(porta.agendamentos).toHaveLength(0);
  });

  it("recusa cancelar em cima da hora", async () => {
    const porta = new AgendaPortFake();
    const inicio = addMinutes(AGORA, 30); // só 30min à frente — menor que a antecedência mínima (2h)
    porta.semear({ telefone: TELEFONE, servico: "corte", inicio, fim: addMinutes(inicio, 40) });

    let resposta = await processarMensagem("3", CONTEXTO_INICIAL, TELEFONE, porta, AGORA);
    resposta = await processarMensagem("1", resposta.contexto, TELEFONE, porta, AGORA);

    expect(resposta.mensagens[0]).toMatch(/não dá mais pra cancelar/i);
    expect(porta.agendamentos).toHaveLength(1); // continua existindo
  });
});

describe("processarMensagem — atendimento humano", () => {
  it("fica em silêncio enquanto um humano assumiu a conversa, e volta ao digitar 'menu'", async () => {
    const porta = new AgendaPortFake();
    let resposta = await processarMensagem("6", CONTEXTO_INICIAL, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.FALANDO_COM_ATENDENTE);

    resposta = await processarMensagem("oi, tudo bem?", resposta.contexto, TELEFONE, porta, AGORA);
    expect(resposta.mensagens).toHaveLength(0);
    expect(resposta.contexto.estado).toBe(EstadoConversa.FALANDO_COM_ATENDENTE);

    resposta = await processarMensagem("menu", resposta.contexto, TELEFONE, porta, AGORA);
    expect(resposta.contexto.estado).toBe(EstadoConversa.MENU);
  });
});
