import { ANTECEDENCIA_MINIMA_CANCELAMENTO_HORAS } from "../domain/businessHours.js";
import { interpretarData } from "../domain/parseData.js";
import { horariosDisponiveis, podeCancelar, tentarAgendar } from "../domain/scheduling.js";
import { CATALOGO_SERVICOS, buscarServico } from "../domain/services.js";
import { extrairNumero, normalizar } from "../utils/texto.js";
import {
  MENU_TEXTO,
  textoCatalogo,
  textoHorarioFuncionamento,
  textoListaAgendamentos,
  textoListaHorarios,
  textoListaServicos,
  textoMotivoRecusa,
} from "./mensagens.js";
import type { AgendaPort } from "./ports.js";
import { CONTEXTO_INICIAL, EstadoConversa, type SessaoContexto } from "./states.js";

export interface RespostaRouter {
  contexto: SessaoContexto;
  mensagens: string[];
}

function respostaMenu(mensagens: string[]): RespostaRouter {
  return { contexto: CONTEXTO_INICIAL, mensagens: [...mensagens, MENU_TEXTO] };
}

/**
 * Função pura (dado o `AgendaPort` injetado) que decide a próxima mensagem e
 * o próximo estado da conversa a partir do texto recebido. Não conhece nada
 * sobre WhatsApp, filas ou banco de dados — por isso é 100% testável sem
 * infraestrutura nenhuma (ver test/router.test.ts).
 */
export async function processarMensagem(
  textoRecebido: string,
  contexto: SessaoContexto,
  telefone: string,
  porta: AgendaPort,
  agora: Date = new Date(),
): Promise<RespostaRouter> {
  const textoNormalizado = normalizar(textoRecebido);

  // Escape hatch global: em qualquer estado, "menu" sempre volta pro início.
  if (textoNormalizado === "menu") {
    return respostaMenu([]);
  }

  // Enquanto um humano assumiu a conversa, o bot fica em silêncio.
  if (contexto.estado === EstadoConversa.FALANDO_COM_ATENDENTE) {
    return { contexto, mensagens: [] };
  }

  switch (contexto.estado) {
    case EstadoConversa.MENU:
      return tratarMenu(textoRecebido, telefone, porta, agora);

    case EstadoConversa.AGENDAR_SERVICO:
      return tratarEscolhaServico(textoRecebido);

    case EstadoConversa.AGENDAR_DATA:
      return tratarEscolhaData(textoRecebido, contexto, porta, agora);

    case EstadoConversa.AGENDAR_HORARIO:
      return tratarEscolhaHorario(textoRecebido, contexto, telefone, porta, agora);

    case EstadoConversa.CANCELAR_ESCOLHER:
      return tratarCancelamento(textoRecebido, contexto, porta, agora);

    default:
      return respostaMenu([]);
  }
}

async function tratarMenu(
  texto: string,
  telefone: string,
  porta: AgendaPort,
  agora: Date,
): Promise<RespostaRouter> {
  switch (extrairNumero(texto)) {
    case 1:
      return { contexto: { estado: EstadoConversa.AGENDAR_SERVICO }, mensagens: [textoListaServicos()] };

    case 2: {
      const agendamentos = await porta.listarAgendamentosFuturosDoCliente(telefone, agora);
      if (agendamentos.length === 0) {
        return respostaMenu(["Você não tem nenhum agendamento marcado no momento."]);
      }
      return respostaMenu([textoListaAgendamentos(agendamentos)]);
    }

    case 3: {
      const agendamentos = await porta.listarAgendamentosFuturosDoCliente(telefone, agora);
      if (agendamentos.length === 0) {
        return respostaMenu(["Você não tem nenhum agendamento pra cancelar."]);
      }
      return {
        contexto: {
          estado: EstadoConversa.CANCELAR_ESCOLHER,
          agendamentosOferecidos: agendamentos.map((a) => a.id),
        },
        mensagens: [`${textoListaAgendamentos(agendamentos)}\n\nResponda com o número do que deseja cancelar, ou 0 para voltar.`],
      };
    }

    case 4:
      return respostaMenu([textoCatalogo()]);

    case 5:
      return respostaMenu([textoHorarioFuncionamento()]);

    case 6:
      return {
        contexto: { estado: EstadoConversa.FALANDO_COM_ATENDENTE },
        mensagens: [
          "Certo! Um atendente vai continuar a conversa por aqui. Se quiser voltar ao assistente automático a qualquer momento, é só digitar *menu*.",
        ],
      };

    default:
      return respostaMenu(["Não entendi essa opção 🤔"]);
  }
}

function tratarEscolhaServico(texto: string): RespostaRouter {
  const numero = extrairNumero(texto);
  const servico = numero ? CATALOGO_SERVICOS[numero - 1] : undefined;

  if (!servico) {
    return { contexto: { estado: EstadoConversa.AGENDAR_SERVICO }, mensagens: [`Não achei essa opção.\n\n${textoListaServicos()}`] };
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
  agora: Date,
): Promise<RespostaRouter> {
  const servico = contexto.servicoSelecionado ? buscarServico(contexto.servicoSelecionado) : undefined;
  if (!servico) return respostaMenu(["Foi mal, perdi o fio da meada. Vamos começar de novo?"]);

  const data = interpretarData(texto, agora);
  if (!data) {
    return {
      contexto,
      mensagens: ['Não entendi a data. Tente "hoje", "amanhã" ou o formato dd/mm (ex: 05/10).'],
    };
  }

  const existentes = await porta.listarAgendamentosDoDia(data);
  const livres = horariosDisponiveis(data, servico.duracaoMin, existentes, agora);

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
  agora: Date,
): Promise<RespostaRouter> {
  const servico = contexto.servicoSelecionado ? buscarServico(contexto.servicoSelecionado) : undefined;
  if (!servico) return respostaMenu(["Foi mal, perdi o fio da meada. Vamos começar de novo?"]);

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
  const resultado = tentarAgendar({ inicio, duracaoMin: servico.duracaoMin, agendamentosExistentes: existentesAgora, agora });

  if (!resultado.ok) {
    const motivo = textoMotivoRecusa(resultado.motivo);
    const livres = horariosDisponiveis(inicio, servico.duracaoMin, existentesAgora, agora);
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

  return respostaMenu([
    `✅ Agendamento confirmado! *${servico.nome}* — id #${id.slice(0, 8)}.\n\nTe esperamos na Barba & Ofício!`,
  ]);
}

async function tratarCancelamento(
  texto: string,
  contexto: SessaoContexto,
  porta: AgendaPort,
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
    return respostaMenu(["Não achei mais esse agendamento — talvez já tenha sido cancelado."]);
  }

  if (!podeCancelar(agendamento.inicio, agora)) {
    return respostaMenu([
      `Esse agendamento é em menos de ${ANTECEDENCIA_MINIMA_CANCELAMENTO_HORAS}h, não dá mais pra cancelar por aqui. Escolha a opção 6 no menu pra falar com um atendente.`,
    ]);
  }

  await porta.cancelarAgendamento(idEscolhido);
  return respostaMenu(["Agendamento cancelado ✅"]);
}
