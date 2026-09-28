import type { IntervaloAgendado } from "../domain/scheduling.js";

export interface AgendamentoResumo {
  id: string;
  servico: string;
  inicio: Date;
}

/**
 * Porta (no sentido de arquitetura hexagonal) entre a máquina de estados da
 * conversa e a persistência real. O router só enxerga esta interface — em
 * produção ela é implementada com better-sqlite3 (ver src/db), e nos testes é
 * implementada por um fake em memória, sem precisar de banco nenhum.
 */
export interface AgendaPort {
  listarAgendamentosDoDia(data: Date): Promise<IntervaloAgendado[]>;
  criarAgendamento(input: {
    telefone: string;
    servico: string;
    inicio: Date;
    fim: Date;
  }): Promise<{ id: string }>;
  listarAgendamentosFuturosDoCliente(telefone: string, agora: Date): Promise<AgendamentoResumo[]>;
  buscarAgendamentoPorId(id: string): Promise<AgendamentoResumo | null>;
  cancelarAgendamento(id: string): Promise<void>;
}

export interface AgendamentoDoDia {
  telefone: string;
  servico: string;
  inicio: Date;
}

/** Porta separada para relatórios administrativos (dono do negócio), fora do fluxo do cliente. */
export interface RelatorioPort {
  listarResumoDoDia(data: Date): Promise<AgendamentoDoDia[]>;
}
