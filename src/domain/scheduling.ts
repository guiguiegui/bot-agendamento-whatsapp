import { addDays, addMinutes, differenceInHours, setHours, setMilliseconds, setMinutes, setSeconds } from "date-fns";
import { ANTECEDENCIA_MINIMA_CANCELAMENTO_HORAS, JANELA_AGENDAMENTO_DIAS, faixaDoDia } from "./businessHours.js";

export interface IntervaloAgendado {
  inicio: Date;
  fim: Date;
}

export type MotivoRecusa =
  | "no_passado"
  | "fora_da_janela"
  | "fora_do_horario"
  | "conflito_de_horario";

export type ResultadoAgendamento =
  | { ok: true; inicio: Date; fim: Date }
  | { ok: false; motivo: MotivoRecusa };

/** Ajusta `data` para o horário informado, mantendo dia/mês/ano. */
function comHorario(data: Date, hora: number, minuto: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(data, hora), minuto), 0), 0);
}

/** Dois intervalos [inicio, fim) se sobrepõem quando um começa antes do outro terminar. */
export function intervalosSeSobrepoem(a: IntervaloAgendado, b: IntervaloAgendado): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Gera os horários candidatos de um dia para um serviço de `duracaoMin` minutos,
 * respeitando o horário de funcionamento e um passo fixo entre encaixes (padrão 30min).
 * Não considera agendamentos já existentes — isso é feito em `horariosDisponiveis`.
 */
export function gerarHorariosCandidatos(data: Date, duracaoMin: number, passoMin = 30): Date[] {
  const faixa = faixaDoDia(data);
  if (!faixa) return [];

  const abertura = comHorario(data, faixa.abreHora, faixa.abreMinuto);
  const fechamento = comHorario(data, faixa.fechaHora, faixa.fechaMinuto);

  const candidatos: Date[] = [];
  let cursor = abertura;
  while (addMinutes(cursor, duracaoMin) <= fechamento) {
    candidatos.push(cursor);
    cursor = addMinutes(cursor, passoMin);
  }
  return candidatos;
}

/**
 * Horários realmente disponíveis num dia: remove os que já passaram (se for hoje)
 * e os que colidem com agendamentos existentes.
 */
export function horariosDisponiveis(
  data: Date,
  duracaoMin: number,
  agendamentosExistentes: IntervaloAgendado[],
  agora: Date = new Date(),
  passoMin = 30,
): Date[] {
  return gerarHorariosCandidatos(data, duracaoMin, passoMin).filter((inicio) => {
    if (inicio < agora) return false;
    const fim = addMinutes(inicio, duracaoMin);
    const candidato: IntervaloAgendado = { inicio, fim };
    return !agendamentosExistentes.some((existente) => intervalosSeSobrepoem(candidato, existente));
  });
}

/**
 * Valida e "reserva" (do ponto de vista de regras de negócio puras) um horário.
 * Não toca em banco de dados — a camada de persistência decide o que fazer com o resultado.
 */
export function tentarAgendar(params: {
  inicio: Date;
  duracaoMin: number;
  agendamentosExistentes: IntervaloAgendado[];
  agora?: Date;
}): ResultadoAgendamento {
  const agora = params.agora ?? new Date();
  const { inicio, duracaoMin, agendamentosExistentes } = params;
  const fim = addMinutes(inicio, duracaoMin);

  if (inicio < agora) {
    return { ok: false, motivo: "no_passado" };
  }
  if (inicio > addDays(agora, JANELA_AGENDAMENTO_DIAS)) {
    return { ok: false, motivo: "fora_da_janela" };
  }

  const faixa = faixaDoDia(inicio);
  if (!faixa) {
    return { ok: false, motivo: "fora_do_horario" };
  }
  const abertura = comHorario(inicio, faixa.abreHora, faixa.abreMinuto);
  const fechamento = comHorario(inicio, faixa.fechaHora, faixa.fechaMinuto);
  if (inicio < abertura || fim > fechamento) {
    return { ok: false, motivo: "fora_do_horario" };
  }

  const candidato: IntervaloAgendado = { inicio, fim };
  const conflito = agendamentosExistentes.some((existente) => intervalosSeSobrepoem(candidato, existente));
  if (conflito) {
    return { ok: false, motivo: "conflito_de_horario" };
  }

  return { ok: true, inicio, fim };
}

/** Regra de cancelamento: precisa de antecedência mínima configurada. */
export function podeCancelar(inicioAgendamento: Date, agora: Date = new Date()): boolean {
  return differenceInHours(inicioAgendamento, agora) >= ANTECEDENCIA_MINIMA_CANCELAMENTO_HORAS;
}
