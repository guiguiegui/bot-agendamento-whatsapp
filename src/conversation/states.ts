export enum EstadoConversa {
  MENU = "MENU",
  AGENDAR_SERVICO = "AGENDAR_SERVICO",
  AGENDAR_DATA = "AGENDAR_DATA",
  AGENDAR_HORARIO = "AGENDAR_HORARIO",
  CANCELAR_ESCOLHER = "CANCELAR_ESCOLHER",
  FALANDO_COM_ATENDENTE = "FALANDO_COM_ATENDENTE",
}

/**
 * Estado da conversa de um cliente. Precisa ser serializável em JSON puro
 * (é isso que fica guardado no Redis entre uma mensagem e outra).
 */
export interface SessaoContexto {
  estado: EstadoConversa;
  servicoSelecionado?: string;
  /** ISO datetimes oferecidos na última lista de horários mostrada. */
  horariosOferecidos?: string[];
  /** ids de agendamento oferecidos na última lista de cancelamento mostrada. */
  agendamentosOferecidos?: string[];
}

export const CONTEXTO_INICIAL: SessaoContexto = { estado: EstadoConversa.MENU };

const ESTADOS_VALIDOS: readonly string[] = Object.values(EstadoConversa);

function ehArrayDeStrings(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((item) => typeof item === "string");
}

/**
 * Valida em runtime se um valor desserializado (ex: JSON.parse de uma sessão
 * salva no Redis) tem o formato de `SessaoContexto`. Sem isso, uma sessão
 * salva por uma versão anterior do bot (com um formato de estado diferente)
 * seria aceita como válida por um simples `as SessaoContexto` e quebraria
 * mais tarde, dentro do router, de um jeito difícil de rastrear até a causa.
 */
export function pareceSessaoValida(valor: unknown): valor is SessaoContexto {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;

  if (typeof v.estado !== "string" || !ESTADOS_VALIDOS.includes(v.estado)) return false;
  if (v.servicoSelecionado !== undefined && typeof v.servicoSelecionado !== "string") return false;
  if (v.horariosOferecidos !== undefined && !ehArrayDeStrings(v.horariosOferecidos)) return false;
  if (v.agendamentosOferecidos !== undefined && !ehArrayDeStrings(v.agendamentosOferecidos)) return false;

  return true;
}
