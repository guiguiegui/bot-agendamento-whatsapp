/**
 * Horário de funcionamento — hoje representado como `Record<number, FaixaHorario | null>`,
 * uma entrada por dia da semana.
 *
 * 0 = domingo ... 6 = sábado (convenção de Date#getDay()).
 */
export interface FaixaHorario {
  abreHora: number;
  abreMinuto: number;
  fechaHora: number;
  fechaMinuto: number;
}

/** Retorna a faixa de funcionamento do dia da semana de `data`, ou `null` se fechado. */
export function faixaDoDia(
  horarioFuncionamento: Record<number, FaixaHorario | null>,
  data: Date,
): FaixaHorario | null {
  return horarioFuncionamento[data.getDay()] ?? null;
}
