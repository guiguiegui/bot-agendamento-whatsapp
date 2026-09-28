import { beforeEach, describe, expect, it, vi } from "vitest";

describe("metricas", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("começa zerada", async () => {
    const { obterMetricas } = await import("../src/utils/metricas.js");
    expect(obterMetricas()).toEqual({
      mensagensProcessadas: 0,
      mensagensComFalha: 0,
      latenciaMediaMs: 0,
      latenciaMaximaMs: 0,
    });
  });

  it("conta sucesso e falha separadamente", async () => {
    const { registrarProcessamento, obterMetricas } = await import("../src/utils/metricas.js");
    registrarProcessamento(100, true);
    registrarProcessamento(200, true);
    registrarProcessamento(50, false);

    const metricas = obterMetricas();
    expect(metricas.mensagensProcessadas).toBe(2);
    expect(metricas.mensagensComFalha).toBe(1);
  });

  it("calcula latência média sobre todas as chamadas (sucesso + falha)", async () => {
    const { registrarProcessamento, obterMetricas } = await import("../src/utils/metricas.js");
    registrarProcessamento(100, true);
    registrarProcessamento(200, true);
    registrarProcessamento(300, false);

    expect(obterMetricas().latenciaMediaMs).toBe(200); // (100+200+300)/3
  });

  it("acompanha a latência máxima já vista", async () => {
    const { registrarProcessamento, obterMetricas } = await import("../src/utils/metricas.js");
    registrarProcessamento(50, true);
    registrarProcessamento(900, false);
    registrarProcessamento(10, true);

    expect(obterMetricas().latenciaMaximaMs).toBe(900);
  });
});
