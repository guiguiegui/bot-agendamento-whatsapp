import { addDays, startOfDay } from "date-fns";
import type { AgendaPort, AgendamentoResumo } from "../../src/conversation/ports.js";
import type { IntervaloAgendado } from "../../src/domain/scheduling.js";
import type { ServicoId } from "../../src/domain/services.js";

interface AgendamentoInterno {
  id: string;
  telefone: string;
  servico: ServicoId;
  inicio: Date;
  fim: Date;
}

/**
 * Implementação em memória do `AgendaPort`, usada só nos testes. Deixa a
 * máquina de estados 100% testável sem precisar subir banco nenhum.
 */
export class AgendaPortFake implements AgendaPort {
  agendamentos: AgendamentoInterno[] = [];
  private contador = 0;

  async listarAgendamentosDoDia(data: Date): Promise<IntervaloAgendado[]> {
    const inicioDia = startOfDay(data);
    const fimDia = addDays(inicioDia, 1);
    return this.agendamentos
      .filter((a) => a.inicio >= inicioDia && a.inicio < fimDia)
      .map((a) => ({ inicio: a.inicio, fim: a.fim }));
  }

  async criarAgendamento(input: { telefone: string; servico: ServicoId; inicio: Date; fim: Date }) {
    const id = `ag-${++this.contador}`;
    this.agendamentos.push({ id, ...input });
    return { id };
  }

  async listarAgendamentosFuturosDoCliente(telefone: string, agora: Date): Promise<AgendamentoResumo[]> {
    return this.agendamentos
      .filter((a) => a.telefone === telefone && a.inicio >= agora)
      .map((a) => ({ id: a.id, servico: a.servico, inicio: a.inicio }));
  }

  async buscarAgendamentoPorId(id: string): Promise<AgendamentoResumo | null> {
    const a = this.agendamentos.find((x) => x.id === id);
    return a ? { id: a.id, servico: a.servico, inicio: a.inicio } : null;
  }

  async cancelarAgendamento(id: string): Promise<void> {
    this.agendamentos = this.agendamentos.filter((a) => a.id !== id);
  }

  /** Atalho só de teste: injeta um agendamento já existente direto no "banco". */
  semear(input: { telefone: string; servico: ServicoId; inicio: Date; fim: Date }) {
    const id = `ag-${++this.contador}`;
    this.agendamentos.push({ id, ...input });
    return id;
  }
}
