import type { AgendaPort } from "../conversation/ports.js";
import type { Negocio, ServicoNegocio } from "../domain/negocio.js";
import { horariosDisponiveis, tentarAgendar, type MotivoRecusa } from "../domain/scheduling.js";

export type ResultadoConfirmacao =
  | { ok: true; id: string; inicio: Date; fim: Date }
  | { ok: false; motivo: MotivoRecusa; horariosAlternativos: Date[] };

/**
 * Confirma (ou recusa) um horário escolhido pelo cliente. Revalida contra o
 * estado atual do banco antes de decidir — evita corrida entre dois clientes
 * escolhendo o mesmo horário ao mesmo tempo. Em caso de recusa, já devolve os
 * horários alternativos daquele mesmo dia, pra quem chama não precisar
 * recalcular.
 */
export class ConfirmarAgendamentoUseCase {
  constructor(private readonly porta: AgendaPort) {}

  async executar(input: {
    negocio: Negocio;
    servico: ServicoNegocio;
    telefone: string;
    inicio: Date;
    agora: Date;
  }): Promise<ResultadoConfirmacao> {
    const { negocio, servico, telefone, inicio, agora } = input;

    const agendamentosExistentes = await this.porta.listarAgendamentosDoDia(inicio);
    const resultado = tentarAgendar({
      horarioFuncionamento: negocio.horarioFuncionamento,
      janelaAgendamentoDias: negocio.janelaAgendamentoDias,
      inicio,
      duracaoMin: servico.duracaoMin,
      agendamentosExistentes,
      agora,
    });

    if (!resultado.ok) {
      const horariosAlternativos = horariosDisponiveis({
        horarioFuncionamento: negocio.horarioFuncionamento,
        data: inicio,
        duracaoMin: servico.duracaoMin,
        agendamentosExistentes,
        agora,
      });
      return { ok: false, motivo: resultado.motivo, horariosAlternativos };
    }

    const { id } = await this.porta.criarAgendamento({
      telefone,
      servico: servico.id,
      inicio: resultado.inicio,
      fim: resultado.fim,
    });

    return { ok: true, id, inicio: resultado.inicio, fim: resultado.fim };
  }
}
