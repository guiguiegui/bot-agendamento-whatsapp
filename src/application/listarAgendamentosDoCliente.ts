import type { AgendaPort, AgendamentoResumo } from "../conversation/ports.js";

/** Agendamentos futuros de um cliente — reaproveitado tanto pra "meus agendamentos" quanto pra iniciar um cancelamento. */
export class ListarAgendamentosDoClienteUseCase {
  constructor(private readonly porta: AgendaPort) {}

  async executar(input: { telefone: string; agora: Date }): Promise<AgendamentoResumo[]> {
    return this.porta.listarAgendamentosFuturosDoCliente(input.telefone, input.agora);
  }
}
