import type { Metricas } from "./metricas.js";

/** Decide status HTTP a partir dos dois sinais de saúde — pura, sem I/O. */
export function avaliarSaude(dbOk: boolean, redisOk: boolean): { saudavel: boolean; status: number } {
  const saudavel = dbOk && redisOk;
  return { saudavel, status: saudavel ? 200 : 503 };
}

/** Monta o corpo JSON de /metrics — pura, sem I/O. */
export function montarCorpoMetricas(metricas: Metricas, contagemFila: Record<string, number>): string {
  return JSON.stringify({ ...metricas, fila: contagemFila });
}
