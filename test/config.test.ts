import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config — fuso horário", () => {
  const tzOriginal = process.env.TZ;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });

  it("define America/Sao_Paulo quando TZ não foi configurado no ambiente", async () => {
    delete process.env.TZ;
    await import("../src/config.js");
    expect(process.env.TZ).toBe("America/Sao_Paulo");
  });

  it("respeita um TZ já configurado explicitamente, sem sobrescrever", async () => {
    process.env.TZ = "UTC";
    await import("../src/config.js");
    expect(process.env.TZ).toBe("UTC");
  });
});
