/**
 * Horário de funcionamento do negócio. Reaproveita os mesmos horários usados
 * na landing page do projeto de portfólio (Barba & Ofício), para que os dois
 * artefatos contem a mesma história de cliente fictício.
 *
 * 0 = domingo ... 6 = sábado (convenção de Date#getDay()).
 */
export interface FaixaHorario {
  abreHora: number;
  abreMinuto: number;
  fechaHora: number;
  fechaMinuto: number;
}

export const HORARIO_FUNCIONAMENTO: Record<number, FaixaHorario | null> = {
  0: null, // domingo — fechado
  1: null, // segunda — fechado
  2: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // terça
  3: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // quarta
  4: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // quinta
  5: { abreHora: 9, abreMinuto: 0, fechaHora: 19, fechaMinuto: 0 }, // sexta
  6: { abreHora: 8, abreMinuto: 0, fechaHora: 17, fechaMinuto: 0 }, // sábado
};

/** Retorna a faixa de funcionamento do dia da semana de `data`, ou `null` se fechado. */
export function faixaDoDia(data: Date): FaixaHorario | null {
  return HORARIO_FUNCIONAMENTO[data.getDay()] ?? null;
}

/** Antecedência mínima, em horas, para cancelar um agendamento sem custo. */
export const ANTECEDENCIA_MINIMA_CANCELAMENTO_HORAS = 2;

/** Quantos dias no futuro o bot aceita oferecer para agendamento. */
export const JANELA_AGENDAMENTO_DIAS = 14;
