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
