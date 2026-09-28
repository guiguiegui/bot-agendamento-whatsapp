import type { AgendaPort } from "../conversation/ports.js";
import { podeCancelar } from "../domain/scheduling.js";

export type ResultadoCancelamento =
  | { ok: true }
  | { ok: false; motivo: "nao_encontrado" | "antecedencia_insuficiente" };

/** Cancela um agendamento existente, respeitando a antecedência mínima configurada pro negócio. */
export class CancelarAgendamentoUseCase {
  constructor(private readonly porta: AgendaPort) {}

  async executar(input: { idAgendamento: string; antecedenciaMinimaHoras: number; agora: Date }): Promise<ResultadoCancelamento> {
    const agendamento = await this.porta.buscarAgendamentoPorId(input.idAgendamento);
    if (!agendamento) {
      return { ok: false, motivo: "nao_encontrado" };
    }

    if (!podeCancelar(input.antecedenciaMinimaHoras, agendamento.inicio, input.agora)) {
      return { ok: false, motivo: "antecedencia_insuficiente" };
    }

    await this.porta.cancelarAgendamento(input.idAgendamento);
    return { ok: true };
  }
}
