import type { Database } from "better-sqlite3";
import type { Negocio, ServicoNegocio } from "../domain/negocio.js";
import type { FaixaHorario } from "../domain/businessHours.js";

interface LinhaNegocio {
  id: string;
  nome: string;
  ativo: number;
  whatsapp_auth_dir: string;
  numeros_admin: string;
  antecedencia_minima_cancelamento_horas: number;
  janela_agendamento_dias: number;
  catalogo_servicos: string;
  horario_funcionamento: string;
}

function linhaParaNegocio(linha: LinhaNegocio): Negocio {
  return {
    id: linha.id,
    nome: linha.nome,
    ativo: linha.ativo === 1,
    whatsappAuthDir: linha.whatsapp_auth_dir,
    numerosAdmin: linha.numeros_admin
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    antecedenciaMinimaCancelamentoHoras: linha.antecedencia_minima_cancelamento_horas,
    janelaAgendamentoDias: linha.janela_agendamento_dias,
    catalogoServicos: JSON.parse(linha.catalogo_servicos) as ServicoNegocio[],
    horarioFuncionamento: JSON.parse(linha.horario_funcionamento) as Record<number, FaixaHorario | null>,
  };
}

/** Leitura da tabela `negocios` — a unidade de multi-tenant (ver domain/negocio.ts). */
export class NegocioRepository {
  constructor(private readonly db: Database) {}

  listarAtivos(): Negocio[] {
    const linhas = this.db.prepare("SELECT * FROM negocios WHERE ativo = 1").all() as LinhaNegocio[];
    return linhas.map(linhaParaNegocio);
  }

  buscarPorId(id: string): Negocio | null {
    const linha = this.db.prepare("SELECT * FROM negocios WHERE id = ?").get(id) as LinhaNegocio | undefined;
    return linha ? linhaParaNegocio(linha) : null;
  }
}
