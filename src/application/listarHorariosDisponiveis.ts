import type { AgendaPort } from "../conversation/ports.js";
import type { Negocio, ServicoNegocio } from "../domain/negocio.js";
import { horariosDisponiveis } from "../domain/scheduling.js";

/** Horários livres num dia, pra um serviço específico do negócio, já descontando agendamentos existentes. */
export class ListarHorariosDisponiveisUseCase {
  constructor(private readonly porta: AgendaPort) {}

  async executar(input: { negocio: Negocio; servico: ServicoNegocio; data: Date; agora: Date }): Promise<Date[]> {
    const agendamentosExistentes = await this.porta.listarAgendamentosDoDia(input.data);
    return horariosDisponiveis({
      horarioFuncionamento: input.negocio.horarioFuncionamento,
      data: input.data,
      duracaoMin: input.servico.duracaoMin,
      agendamentosExistentes,
      agora: input.agora,
    });
  }
}
