import { CancelarAgendamentoUseCase } from "../application/cancelarAgendamento.js";
import { ConfirmarAgendamentoUseCase } from "../application/confirmarAgendamento.js";
import { ListarAgendamentosDoClienteUseCase } from "../application/listarAgendamentosDoCliente.js";
import { ListarHorariosDisponiveisUseCase } from "../application/listarHorariosDisponiveis.js";
import type { Negocio } from "../domain/negocio.js";
import { interpretarData } from "../domain/parseData.js";
import { buscarServico } from "../domain/services.js";
import { mensagens } from "../i18n/pt-BR.js";
import { extrairNumero, normalizar } from "../utils/texto.js";
import type { AgendaPort } from "./ports.js";
import { CONTEXTO_INICIAL, EstadoConversa, type SessaoContexto } from "./states.js";

export interface RespostaRouter {
  contexto: SessaoContexto;
  mensagens: string[];
}

function respostaMenu(msgs: string[], nomeNegocio: string): RespostaRouter {
  return { contexto: CONTEXTO_INICIAL, mensagens: [...msgs, mensagens.menu(nomeNegocio)] };
}

/**
 * Função pura (dado o `AgendaPort` e o `Negocio` injetados) que decide a
 * próxima mensagem e o próximo estado da conversa a partir do texto
 * recebido. Não conhece nada sobre WhatsApp, filas ou banco de dados — por
 * isso é 100% testável sem infraestrutura nenhuma (ver test/router.test.ts).
 *
 * A decisão de negócio em si (o horário pode ser confirmado? o cancelamento
 * é aceito?) mora em `src/application/` — o router só orquestra estado:
 * parseia o texto, delega ao caso de uso certo, e traduz o resultado em
 * mensagem (via `src/i18n/pt-BR.ts`, ver ADR 8) + próximo estado (ver ADR 7).
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
        mensagens: [mensagens.listaServicos(negocio.catalogoServicos)],
      };

    case 2: {
      const agendamentos = await new ListarAgendamentosDoClienteUseCase(porta).executar({ telefone, agora });
      if (agendamentos.length === 0) {
        return respostaMenu([mensagens.semAgendamentoMarcado()], negocio.nome);
      }
      return respostaMenu([mensagens.listaAgendamentos(agendamentos, negocio.catalogoServicos)], negocio.nome);
    }

    case 3: {
      const agendamentos = await new ListarAgendamentosDoClienteUseCase(porta).executar({ telefone, agora });
      if (agendamentos.length === 0) {
        return respostaMenu([mensagens.semAgendamentoParaCancelar()], negocio.nome);
      }
      return {
        contexto: {
          estado: EstadoConversa.CANCELAR_ESCOLHER,
          agendamentosOferecidos: agendamentos.map((a) => a.id),
        },
        mensagens: [
          `${mensagens.listaAgendamentos(agendamentos, negocio.catalogoServicos)}\n\n${mensagens.escolhaParaCancelar()}`,
        ],
      };
    }

    case 4:
      return respostaMenu([mensagens.catalogo(negocio.catalogoServicos)], negocio.nome);

    case 5:
      return respostaMenu([mensagens.horarioFuncionamento(negocio.horarioFuncionamento)], negocio.nome);

    case 6:
      return {
        contexto: { estado: EstadoConversa.FALANDO_COM_ATENDENTE },
        mensagens: [mensagens.atendenteHumano()],
      };

    default:
      return respostaMenu([mensagens.opcaoInvalida()], negocio.nome);
  }
}

function tratarEscolhaServico(texto: string, negocio: Negocio): RespostaRouter {
  const numero = extrairNumero(texto);
  const servico = numero ? negocio.catalogoServicos[numero - 1] : undefined;

  if (!servico) {
    return {
      contexto: { estado: EstadoConversa.AGENDAR_SERVICO },
      mensagens: [`${mensagens.servicoNaoEncontrado()}\n\n${mensagens.listaServicos(negocio.catalogoServicos)}`],
    };
  }

  return {
    contexto: { estado: EstadoConversa.AGENDAR_DATA, servicoSelecionado: servico.id },
    mensagens: [mensagens.servicoEscolhido(servico.nome)],
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
  if (!servico) return respostaMenu([mensagens.contextoPerdido()], negocio.nome);

  const data = interpretarData(texto, agora);
  if (!data) {
    return { contexto, mensagens: [mensagens.dataNaoReconhecida()] };
  }

  const livres = await new ListarHorariosDisponiveisUseCase(porta).executar({ negocio, servico, data, agora });

  if (livres.length === 0) {
    return { contexto, mensagens: [mensagens.semHorarioLivreNoDia()] };
  }

  return {
    contexto: {
      estado: EstadoConversa.AGENDAR_HORARIO,
      servicoSelecionado: servico.id,
      horariosOferecidos: livres.map((h) => h.toISOString()),
    },
    mensagens: [mensagens.listaHorarios(livres, servico)],
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
  if (!servico) return respostaMenu([mensagens.contextoPerdido()], negocio.nome);

  const numero = extrairNumero(texto);
  const oferecidos = contexto.horariosOferecidos ?? [];
  const isoEscolhido = numero ? oferecidos[numero - 1] : undefined;

  if (!isoEscolhido) {
    return { contexto, mensagens: [mensagens.escolhaHorarioInvalido()] };
  }

  const inicio = new Date(isoEscolhido);
  const resultado = await new ConfirmarAgendamentoUseCase(porta).executar({ negocio, servico, telefone, inicio, agora });

  if (!resultado.ok) {
    const motivo = mensagens.motivoRecusa(resultado.motivo);
    if (resultado.horariosAlternativos.length === 0) {
      return {
        contexto: { estado: EstadoConversa.AGENDAR_DATA, servicoSelecionado: servico.id },
        mensagens: [mensagens.semOutroHorarioNoDia(motivo)],
      };
    }
    return {
      contexto: {
        estado: EstadoConversa.AGENDAR_HORARIO,
        servicoSelecionado: servico.id,
        horariosOferecidos: resultado.horariosAlternativos.map((h) => h.toISOString()),
      },
      mensagens: [mensagens.horariosAtualizados(motivo, mensagens.listaHorarios(resultado.horariosAlternativos, servico))],
    };
  }

  return respostaMenu(
    [mensagens.agendamentoConfirmado(servico.nome, resultado.id.slice(0, 8), negocio.nome)],
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
    return { contexto, mensagens: [mensagens.escolhaCancelamentoInvalido()] };
  }

  const resultado = await new CancelarAgendamentoUseCase(porta).executar({
    idAgendamento: idEscolhido,
    antecedenciaMinimaHoras: negocio.antecedenciaMinimaCancelamentoHoras,
    agora,
  });

  if (!resultado.ok) {
    if (resultado.motivo === "nao_encontrado") {
      return respostaMenu([mensagens.agendamentoNaoEncontrado()], negocio.nome);
    }
    return respostaMenu([mensagens.antecedenciaInsuficiente(negocio.antecedenciaMinimaCancelamentoHoras)], negocio.nome);
  }

  return respostaMenu([mensagens.agendamentoCancelado()], negocio.nome);
}
