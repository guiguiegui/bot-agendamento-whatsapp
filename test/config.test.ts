import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VARS_RASTREADAS = ["TZ", "REDIS_URL", "ADMIN_PHONE_NUMBERS"] as const;

describe("config", () => {
  const originais = Object.fromEntries(VARS_RASTREADAS.map((v) => [v, process.env[v]]));

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const v of VARS_RASTREADAS) {
      if (originais[v] === undefined) delete process.env[v];
      else process.env[v] = originais[v];
    }
  });

  describe("fuso horário", () => {
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

  describe("REDIS_URL", () => {
    it("usa o valor padrão quando não configurado", async () => {
      delete process.env.REDIS_URL;
      const { config } = await import("../src/config.js");
      expect(config.redisUrl).toBe("redis://localhost:6379");
    });

    it("aceita uma URL redis:// customizada", async () => {
      process.env.REDIS_URL = "redis://meuhost:6380";
      const { config } = await import("../src/config.js");
      expect(config.redisUrl).toBe("redis://meuhost:6380");
    });

    it("aceita rediss:// (TLS)", async () => {
      process.env.REDIS_URL = "rediss://meuhost:6380";
      const { config } = await import("../src/config.js");
      expect(config.redisUrl).toBe("rediss://meuhost:6380");
    });

    it("rejeita uma URL sem o esquema redis://, no boot (fail-fast)", async () => {
      process.env.REDIS_URL = "localhost:6379";
      await expect(import("../src/config.js")).rejects.toThrow(/REDIS_URL inválida/);
    });
  });

  describe("ADMIN_PHONE_NUMBERS", () => {
    it("aceita não ter nenhum admin configurado", async () => {
      delete process.env.ADMIN_PHONE_NUMBERS;
      const { config } = await import("../src/config.js");
      expect(config.numerosAdmin).toEqual([]);
    });

    it("aceita múltiplos números separados por vírgula, ignorando espaços em volta", async () => {
      process.env.ADMIN_PHONE_NUMBERS = "5519991234567, 5511888888888";
      const { config } = await import("../src/config.js");
      expect(config.numerosAdmin).toEqual(["5519991234567", "5511888888888"]);
    });

    it("rejeita número com '+', espaço ou hífen, no boot (fail-fast)", async () => {
      process.env.ADMIN_PHONE_NUMBERS = "+55 19 99123-4567";
      await expect(import("../src/config.js")).rejects.toThrow(/ADMIN_PHONE_NUMBERS contém um valor inválido/);
    });
  });
});
