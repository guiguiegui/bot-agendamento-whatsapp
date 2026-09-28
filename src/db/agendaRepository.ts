import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { AgendaPort, AgendamentoDoDia, AgendamentoResumo, RelatorioPort } from "../conversation/ports.js";
import type { IntervaloAgendado } from "../domain/scheduling.js";
import type { ServicoId } from "../domain/services.js";

interface LinhaIntervalo {
  inicio: string;
  fim: string;
}

interface LinhaResumo {
  id: string;
  servico: string;
  inicio: string;
}

interface LinhaResumoComTelefone extends LinhaResumo {
  telefone: string;
}

function inicioEFimDoDia(data: Date): { inicioDia: Date; fimDia: Date } {
  const inicioDia = new Date(data);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia);
  fimDia.setDate(fimDia.getDate() + 1);
  return { inicioDia, fimDia };
}

/** Implementação real do `AgendaPort` (+ `RelatorioPort` pro admin), sobre SQLite. */
export class AgendaRepositorySqlite implements AgendaPort, RelatorioPort {
  constructor(private readonly db: Database) {}

  private garantirCliente(telefone: string): void {
    this.db
      .prepare("INSERT INTO clientes (id, telefone) VALUES (?, ?) ON CONFLICT(telefone) DO NOTHING")
      .run(randomUUID(), telefone);
  }

  async listarAgendamentosDoDia(data: Date): Promise<IntervaloAgendado[]> {
    const { inicioDia, fimDia } = inicioEFimDoDia(data);
    const linhas = this.db
      .prepare(
        "SELECT inicio, fim FROM agendamentos WHERE status = 'confirmado' AND inicio >= ? AND inicio < ?",
      )
      .all(inicioDia.toISOString(), fimDia.toISOString()) as LinhaIntervalo[];
    return linhas.map((l) => ({ inicio: new Date(l.inicio), fim: new Date(l.fim) }));
  }

  async criarAgendamento(input: {
    telefone: string;
    servico: ServicoId;
    inicio: Date;
    fim: Date;
  }): Promise<{ id: string }> {
    this.garantirCliente(input.telefone);
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO agendamentos (id, telefone, servico, inicio, fim) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, input.telefone, input.servico, input.inicio.toISOString(), input.fim.toISOString());
    return { id };
  }

  async listarAgendamentosFuturosDoCliente(telefone: string, agora: Date): Promise<AgendamentoResumo[]> {
    const linhas = this.db
      .prepare(
        "SELECT id, servico, inicio FROM agendamentos WHERE telefone = ? AND status = 'confirmado' AND inicio >= ? ORDER BY inicio ASC",
      )
      .all(telefone, agora.toISOString()) as LinhaResumo[];
    return linhas.map((l) => ({ id: l.id, servico: l.servico as ServicoId, inicio: new Date(l.inicio) }));
  }

  async buscarAgendamentoPorId(id: string): Promise<AgendamentoResumo | null> {
    const linha = this.db
      .prepare("SELECT id, servico, inicio FROM agendamentos WHERE id = ? AND status = 'confirmado'")
      .get(id) as LinhaResumo | undefined;
    return linha ? { id: linha.id, servico: linha.servico as ServicoId, inicio: new Date(linha.inicio) } : null;
  }

  async cancelarAgendamento(id: string): Promise<void> {
    this.db.prepare("UPDATE agendamentos SET status = 'cancelado' WHERE id = ?").run(id);
  }

  /** Usado só pelo comando de admin: todos os agendamentos de um dia, de todos os clientes. */
  async listarResumoDoDia(data: Date): Promise<AgendamentoDoDia[]> {
    const { inicioDia, fimDia } = inicioEFimDoDia(data);
    const linhas = this.db
      .prepare(
        "SELECT telefone, servico, inicio FROM agendamentos WHERE status = 'confirmado' AND inicio >= ? AND inicio < ? ORDER BY inicio ASC",
      )
      .all(inicioDia.toISOString(), fimDia.toISOString()) as LinhaResumoComTelefone[];
    return linhas.map((l) => ({ telefone: l.telefone, servico: l.servico as ServicoId, inicio: new Date(l.inicio) }));
  }
}
