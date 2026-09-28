import { describe, expect, it } from "vitest";
import type { Metricas } from "../src/utils/metricas.js";
import { avaliarSaude, montarCorpoMetricas } from "../src/utils/saude.js";

describe("avaliarSaude", () => {
  it("saudável (200) quando banco e Redis estão ok", () => {
    expect(avaliarSaude(true, true)).toEqual({ saudavel: true, status: 200 });
  });

  it("não saudável (503) quando o banco falha", () => {
    expect(avaliarSaude(false, true)).toEqual({ saudavel: false, status: 503 });
  });

  it("não saudável (503) quando o Redis falha", () => {
    expect(avaliarSaude(true, false)).toEqual({ saudavel: false, status: 503 });
  });

  it("não saudável (503) quando os dois falham", () => {
    expect(avaliarSaude(false, false)).toEqual({ saudavel: false, status: 503 });
  });
});

describe("montarCorpoMetricas", () => {
  it("combina as métricas em memória com a contagem da fila num único JSON", () => {
    const metricas: Metricas = {
      mensagensProcessadas: 10,
      mensagensComFalha: 1,
      latenciaMediaMs: 120,
      latenciaMaximaMs: 900,
    };
    const contagemFila = { waiting: 2, active: 1, completed: 10, failed: 1, delayed: 0 };

    const corpo = JSON.parse(montarCorpoMetricas(metricas, contagemFila)) as Record<string, unknown>;

    expect(corpo).toMatchObject(metricas);
    expect(corpo.fila).toEqual(contagemFila);
  });
});
