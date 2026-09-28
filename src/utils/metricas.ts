/**
 * Contador de métricas em memória — reinicia a zero a cada restart do
 * processo. É pra observabilidade em tempo real (exposto via /metrics em
 * src/health.ts), não um histórico persistente.
 */
interface EstadoMetricas {
  processadas: number;
  falhas: number;
  latenciaTotalMs: number;
  latenciaMaximaMs: number;
}

const estado: EstadoMetricas = {
  processadas: 0,
  falhas: 0,
  latenciaTotalMs: 0,
  latenciaMaximaMs: 0,
};

export function registrarProcessamento(duracaoMs: number, sucesso: boolean): void {
  if (sucesso) {
    estado.processadas += 1;
  } else {
    estado.falhas += 1;
  }
  estado.latenciaTotalMs += duracaoMs;
  estado.latenciaMaximaMs = Math.max(estado.latenciaMaximaMs, duracaoMs);
}

export interface Metricas {
  mensagensProcessadas: number;
  mensagensComFalha: number;
  latenciaMediaMs: number;
  latenciaMaximaMs: number;
}

export function obterMetricas(): Metricas {
  const total = estado.processadas + estado.falhas;
  return {
    mensagensProcessadas: estado.processadas,
    mensagensComFalha: estado.falhas,
    latenciaMediaMs: total > 0 ? Math.round(estado.latenciaTotalMs / total) : 0,
    latenciaMaximaMs: estado.latenciaMaximaMs,
  };
}
