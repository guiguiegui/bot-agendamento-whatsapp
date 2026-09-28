import type { FaixaHorario } from "./businessHours.js";

/**
 * Um serviço oferecido por um negócio específico. Paralelo a `Servico`
 * (services.ts), mas com `id: string` livre em vez de um union fixo — cada
 * negócio define seu próprio catálogo, então não há como fechar esse tipo
 * em tempo de compilação. A unificação dos dois tipos (aposentar o union
 * fixo `ServicoId`) é trabalho de uma fase futura, que passa a de fato ler
 * o catálogo por negócio em vez da constante hardcoded em services.ts.
 */
export interface ServicoNegocio {
  id: string;
  nome: string;
  duracaoMin: number;
  precoCentavos: number;
}

/**
 * Um negócio cadastrado na plataforma — a unidade de multi-tenant. Cada
 * negócio tem seu próprio catálogo, horário de funcionamento, política de
 * cancelamento, números de admin e pasta de sessão do WhatsApp.
 */
export interface Negocio {
  id: string;
  nome: string;
  ativo: boolean;
  whatsappAuthDir: string;
  /** Números (formato internacional, só dígitos) autorizados a usar comandos de admin. */
  numerosAdmin: string[];
  antecedenciaMinimaCancelamentoHoras: number;
  janelaAgendamentoDias: number;
  catalogoServicos: ServicoNegocio[];
  horarioFuncionamento: Record<number, FaixaHorario | null>;
}
