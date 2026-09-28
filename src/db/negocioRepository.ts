import type { Database } from "better-sqlite3";
import type { ConfigNegocio, Negocio, ServicoNegocio } from "../domain/negocio.js";
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

/** Leitura e escrita da tabela `negocios` — a unidade de multi-tenant (ver domain/negocio.ts). */
export class NegocioRepository {
  constructor(private readonly db: Database) {}

  listarAtivos(): Negocio[] {
    const linhas = this.db.prepare("SELECT * FROM negocios WHERE ativo = 1").all() as LinhaNegocio[];
    return linhas.map(linhaParaNegocio);
  }

  /** Ativos e inativos — usado pelo comando `listar` do CLI, pra dar visibilidade dos dois. */
  listarTodos(): Negocio[] {
    const linhas = this.db.prepare("SELECT * FROM negocios").all() as LinhaNegocio[];
    return linhas.map(linhaParaNegocio);
  }

  buscarPorId(id: string): Negocio | null {
    const linha = this.db.prepare("SELECT * FROM negocios WHERE id = ?").get(id) as LinhaNegocio | undefined;
    return linha ? linhaParaNegocio(linha) : null;
  }

  criar(id: string, dados: ConfigNegocio): void {
    this.db
      .prepare(
        `INSERT INTO negocios (
          id, nome, ativo, whatsapp_auth_dir, numeros_admin,
          antecedencia_minima_cancelamento_horas, janela_agendamento_dias,
          catalogo_servicos, horario_funcionamento
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        dados.nome,
        dados.whatsappAuthDir,
        dados.numerosAdmin.join(","),
        dados.antecedenciaMinimaCancelamentoHoras,
        dados.janelaAgendamentoDias,
        JSON.stringify(dados.catalogoServicos),
        JSON.stringify(dados.horarioFuncionamento),
      );
  }

  /** Soft — nunca deleta a linha, só marca como inativo (histórico continua intacto). */
  desativar(id: string): void {
    this.db.prepare("UPDATE negocios SET ativo = 0 WHERE id = ?").run(id);
  }
}
