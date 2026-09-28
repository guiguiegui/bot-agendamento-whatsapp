import type { FaixaHorario } from "./businessHours.js";

/**
 * Um serviço oferecido por um negócio específico. `id: string` é livre (não
 * um union fixo) porque cada negócio define seu próprio catálogo — não há
 * como fechar esse tipo em tempo de compilação.
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

/** Os dados de um negócio antes de existir — `id` e `ativo` são atribuídos na criação. */
export type ConfigNegocio = Omit<Negocio, "id" | "ativo">;

function ehNumeroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function ehArrayDeNumerosAdminValidos(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((item) => typeof item === "string" && /^\d+$/.test(item));
}

function pareceServicoNegocioValido(valor: unknown): valor is ServicoNegocio {
  if (typeof valor !== "object" || valor === null) return false;
  const s = valor as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    typeof s.nome === "string" &&
    s.nome.length > 0 &&
    ehNumeroPositivo(s.duracaoMin) &&
    typeof s.precoCentavos === "number" &&
    Number.isFinite(s.precoCentavos) &&
    s.precoCentavos >= 0
  );
}

function pareceFaixaHorarioValida(valor: unknown): valor is FaixaHorario {
  if (typeof valor !== "object" || valor === null) return false;
  const f = valor as Record<string, unknown>;
  return (
    typeof f.abreHora === "number" &&
    typeof f.abreMinuto === "number" &&
    typeof f.fechaHora === "number" &&
    typeof f.fechaMinuto === "number"
  );
}

const DIAS_DA_SEMANA = ["0", "1", "2", "3", "4", "5", "6"];

function pareceHorarioFuncionamentoValido(valor: unknown): valor is Record<number, FaixaHorario | null> {
  if (typeof valor !== "object" || valor === null) return false;
  const h = valor as Record<string, unknown>;
  return DIAS_DA_SEMANA.every((dia) => {
    if (!(dia in h)) return false;
    const faixa = h[dia];
    return faixa === null || pareceFaixaHorarioValida(faixa);
  });
}

/**
 * Valida a forma de uma config de negócio — ex: vinda de um JSON externo,
 * como em `scripts/negocio-cli.ts criar` — antes de gravar no banco. Mesmo
 * espírito de `pareceSessaoValida` (conversation/states.ts): sem isso, um
 * JSON mal formado só quebraria mais tarde, de um jeito difícil de rastrear
 * até a causa.
 */
export function pareceConfigNegocioValida(valor: unknown): valor is ConfigNegocio {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;

  if (typeof v.nome !== "string" || v.nome.length === 0) return false;
  if (typeof v.whatsappAuthDir !== "string" || v.whatsappAuthDir.length === 0) return false;
  if (!ehArrayDeNumerosAdminValidos(v.numerosAdmin)) return false;
  if (!ehNumeroPositivo(v.antecedenciaMinimaCancelamentoHoras)) return false;
  if (!ehNumeroPositivo(v.janelaAgendamentoDias)) return false;
  if (!Array.isArray(v.catalogoServicos) || v.catalogoServicos.length === 0) return false;
  if (!v.catalogoServicos.every(pareceServicoNegocioValido)) return false;
  if (!pareceHorarioFuncionamentoValido(v.horarioFuncionamento)) return false;

  return true;
}
