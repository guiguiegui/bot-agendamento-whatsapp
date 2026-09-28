import type { Negocio } from "../domain/negocio.js";
import { interpretarData } from "../domain/parseData.js";
import { horariosDisponiveis, podeCancelar, tentarAgendar } from "../domain/scheduling.js";
import { buscarServico } from "../domain/services.js";
import { extrairNumero, normalizar } from "../utils/texto.js";
import {
  textoCatalogo,
  textoHorarioFuncionamento,
  textoListaAgendamentos,
  textoListaHorarios,
  textoListaServicos,
  textoMenu,
  textoMotivoRecusa,
} from "./mensagens.js";
import type { AgendaPort } from "./ports.js";
import { CONTEXTO_INICIAL, EstadoConversa, type SessaoContexto } from "./states.js";

export interface RespostaRouter {
  contexto: SessaoContexto;
  mensagens: string[];
}

function respostaMenu(mensagens: string[], nomeNegocio: string): RespostaRouter {
  return { contexto: CONTEXTO_INICIAL, mensagens: [...mensagens, textoMenu(nomeNegocio)] };
}

/**
 * Função pura (dado o `AgendaPort` e o `Negocio` injetados) que decide a
 * próxima mensagem e o próximo estado da conversa a partir do texto
 * recebido. Não conhece nada sobre WhatsApp, filas ou banco de dados — por
 * isso é 100% testável sem infraestrutura nenhuma (ver test/router.test.ts).
 */
export async function processarMensagem(
  textoRecebido: string,
  contexto: SessaoContexto,
  telefone: string,
  porta: AgendaPort,
  negocio: Negocio,
  agora: Date = new Date(),
): Promise<RespostaRouter> {
  const textoNormalizado = normalizar(textoRecebido);

  // Escape hatch global: em qualquer estado, "menu" sempre volta pro início.
  if (textoNormalizado === "menu") {
    return respostaMenu([], negocio.nome);
  }

  // Enquanto um humano assumiu a conversa, o bot fica em silêncio.
  if (contexto.estado === EstadoConversa.FALANDO_COM_ATENDENTE) {
    return { contexto, mensagens: [] };
  }

  switch (contexto.estado) {
    case EstadoConversa.MENU:
      return tratarMenu(textoRecebido, telefone, porta, negocio, agora);

    case EstadoConversa.AGENDAR_SERVICO:
      return tratarEscolhaServico(textoRecebido, negocio);

    case EstadoConversa.AGENDAR_DATA:
      return tratarEscolhaData(textoRecebido, contexto, porta, negocio, agora);

    case EstadoConversa.AGENDAR_HORARIO:
      return tratarEscolhaHorario(textoRecebido, contexto, telefone, porta, negocio, agora);

    case EstadoConversa.CANCELAR_ESCOLHER:
      return tratarCancelamento(textoRecebido, contexto, porta, negocio, agora);

    default:
      return respostaMenu([], negocio.nome);
  }
}

async function tratarMenu(
  texto: string,
  telefone: string,
  porta: AgendaPort,
  negocio: Negocio,
  agora: Date,
): Promise<RespostaRouter> {
  switch (extrairNumero(texto)) {
    case 1:
      return {
        contexto: { estado: EstadoConversa.AGENDAR_SERVICO },
        mensagens: [textoListaServicos(negocio.catalogoServicos)],
      };

    case 2: {
      const agendamentos = await porta.listarAgendamentosFuturosDoCliente(telefone, agora);
      if (agendamentos.length === 0) {
        return respostaMenu(["Você não tem nenhum agendamento marcado no momento."], negocio.nome);
      }
      return respostaMenu([textoListaAgendamentos(agendamentos, negocio.catalogoServicos)], negocio.nome);
    }

    case 3: {
      const agendamentos = await porta.listarAgendamentosFuturosDoCliente(telefone, agora);
      if (agendamentos.length === 0) {
        return respostaMenu(["Você não tem nenhum agendamento pra cancelar."], negocio.nome);
      }
      return {
        contexto: {
          estado: EstadoConversa.CANCELAR_ESCOLHER,
          agendamentosOferecidos: agendamentos.map((a) => a.id),
        },
        mensagens: [
          `${textoListaAgendamentos(agendamentos, negocio.catalogoServicos)}\n\nResponda com o número do que deseja cancelar, ou 0 para voltar.`,
        ],
      };
    }

    case 4:
      return respostaMenu([textoCatalogo(negocio.catalogoServicos)], negocio.nome);

    case 5:
      return respostaMenu([textoHorarioFuncionamento(negocio.horarioFuncionamento)], negocio.nome);

    case 6:
      return {
        contexto: { estado: EstadoConversa.FALANDO_COM_ATENDENTE },
        mensagens: [
          "Certo! Um atendente vai continuar a conversa por aqui. Se quiser voltar ao assistente automático a qualquer momento, é só digitar *menu*.",
        ],
      };

    default:
      return respostaMenu(["Não entendi essa opção 🤔"], negocio.nome);
  }
}

function tratarEscolhaServico(texto: string, negocio: Negocio): RespostaRouter {
  const numero = extrairNumero(texto);
  const servico = numero ? negocio.catalogoServicos[numero - 1] : undefined;

  if (!servico) {
    return {
      contexto: { estado: EstadoConversa.AGENDAR_SERVICO },
      mensagens: [`Não achei essa opção.\n\n${textoListaServicos(negocio.catalogoServicos)}`],
    };
  }

  return {
    contexto: { estado: EstadoConversa.AGENDAR_DATA, servicoSelecionado: servico.id },
    mensagens: [`Beleza, *${servico.nome}*. Pra quando você quer agendar? Responda "hoje", "amanhã" ou uma data (ex: 05/10).`],
  };
}

async function tratarEscolhaData(
  texto: string,
  contexto: SessaoContexto,
  porta: AgendaPort,
  negocio: Negocio,
  agora: Date,
): Promise<RespostaRouter> {
  const servico = contexto.servicoSelecionado ? buscarServico(negocio.catalogoServicos, contexto.servicoSelecionado) : undefined;
  if (!servico) return respostaMenu(["Foi mal, perdi o fio da meada. Vamos começar de novo?"], negocio.nome);

  const data = interpretarData(texto, agora);
  if (!data) {
    return {
      contexto,
      mensagens: ['Não entendi a data. Tente "hoje", "amanhã" ou o formato dd/mm (ex: 05/10).'],
    };
  }

  const existentes = await porta.listarAgendamentosDoDia(data);
  const livres = horariosDisponiveis({
    horarioFuncionamento: negocio.horarioFuncionamento,
    data,
    duracaoMin: servico.duracaoMin,
    agendamentosExistentes: existentes,
    agora,
  });

  if (livres.length === 0) {
    return { contexto, mensagens: ["Não sobrou horário livre nesse dia pra esse serviço 😕 Tente outra data."] };
  }

  return {
    contexto: {
      estado: EstadoConversa.AGENDAR_HORARIO,
      servicoSelecionado: servico.id,
      horariosOferecidos: livres.map((h) => h.toISOString()),
    },
    mensagens: [textoListaHorarios(livres, servico)],
  };
}

async function tratarEscolhaHorario(
  texto: string,
  contexto: SessaoContexto,
  telefone: string,
  porta: AgendaPort,
  negocio: Negocio,
  agora: Date,
): Promise<RespostaRouter> {
  const servico = contexto.servicoSelecionado ? buscarServico(negocio.catalogoServicos, contexto.servicoSelecionado) : undefined;
  if (!servico) return respostaMenu(["Foi mal, perdi o fio da meada. Vamos começar de novo?"], negocio.nome);

  const numero = extrairNumero(texto);
  const oferecidos = contexto.horariosOferecidos ?? [];
  const isoEscolhido = numero ? oferecidos[numero - 1] : undefined;

  if (!isoEscolhido) {
    return { contexto, mensagens: ["Escolhe um dos números da lista, por favor."] };
  }

  const inicio = new Date(isoEscolhido);
  // Revalida contra o estado atual do banco: evita corrida entre dois clientes
  // escolhendo o mesmo horário ao mesmo tempo.
  const existentesAgora = await porta.listarAgendamentosDoDia(inicio);
  const resultado = tentarAgendar({
    horarioFuncionamento: negocio.horarioFuncionamento,
    janelaAgendamentoDias: negocio.janelaAgendamentoDias,
    inicio,
    duracaoMin: servico.duracaoMin,
    agendamentosExistentes: existentesAgora,
    agora,
  });

  if (!resultado.ok) {
    const motivo = textoMotivoRecusa(resultado.motivo);
    const livres = horariosDisponiveis({
      horarioFuncionamento: negocio.horarioFuncionamento,
      data: inicio,
      duracaoMin: servico.duracaoMin,
      agendamentosExistentes: existentesAgora,
      agora,
    });
    if (livres.length === 0) {
      return {
        contexto: { estado: EstadoConversa.AGENDAR_DATA, servicoSelecionado: servico.id },
        mensagens: [`${motivo} E não sobrou outro horário livre nesse dia 😕 Tente outra data.`],
      };
    }
    return {
      contexto: {
        estado: EstadoConversa.AGENDAR_HORARIO,
        servicoSelecionado: servico.id,
        horariosOferecidos: livres.map((h) => h.toISOString()),
      },
      mensagens: [`${motivo} Horários atualizados:\n\n${textoListaHorarios(livres, servico)}`],
    };
  }

  const { id } = await porta.criarAgendamento({
    telefone,
    servico: servico.id,
    inicio: resultado.inicio,
    fim: resultado.fim,
  });

  return respostaMenu(
    [`✅ Agendamento confirmado! *${servico.nome}* — id #${id.slice(0, 8)}.\n\nTe esperamos na ${negocio.nome}!`],
    negocio.nome,
  );
}

async function tratarCancelamento(
  texto: string,
  contexto: SessaoContexto,
  porta: AgendaPort,
  negocio: Negocio,
  agora: Date,
): Promise<RespostaRouter> {
  const numero = extrairNumero(texto);
  const ids = contexto.agendamentosOferecidos ?? [];
  const idEscolhido = numero ? ids[numero - 1] : undefined;

  if (!idEscolhido) {
    return { contexto, mensagens: ["Escolhe um dos números da lista, ou 0 para voltar ao menu."] };
  }

  const agendamento = await porta.buscarAgendamentoPorId(idEscolhido);
  if (!agendamento) {
    return respostaMenu(["Não achei mais esse agendamento — talvez já tenha sido cancelado."], negocio.nome);
  }

  if (!podeCancelar(negocio.antecedenciaMinimaCancelamentoHoras, agendamento.inicio, agora)) {
    return respostaMenu(
      [
        `Esse agendamento é em menos de ${negocio.antecedenciaMinimaCancelamentoHoras}h, não dá mais pra cancelar por aqui. Escolha a opção 6 no menu pra falar com um atendente.`,
      ],
      negocio.nome,
    );
  }

  await porta.cancelarAgendamento(idEscolhido);
  return respostaMenu(["Agendamento cancelado ✅"], negocio.nome);
}
