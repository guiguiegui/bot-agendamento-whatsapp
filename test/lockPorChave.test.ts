import { setTimeout as esperar } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { criarLockPorChave } from "../src/utils/lockPorChave.js";

describe("criarLockPorChave", () => {
  it("serializa tarefas da mesma chave (não deixa rodar fora de ordem)", async () => {
    const { comLock } = criarLockPorChave();
    const ordem: number[] = [];

    const t1 = comLock("123", async () => {
      await esperar(20);
      ordem.push(1);
    });
    const t2 = comLock("123", () => {
      ordem.push(2);
    });

    await Promise.all([t1, t2]);
    expect(ordem).toEqual([1, 2]);
  });

  it("não serializa tarefas de chaves diferentes", async () => {
    const { comLock } = criarLockPorChave();
    const ordem: string[] = [];

    const lenta = comLock("A", async () => {
      await esperar(20);
      ordem.push("A");
    });
    const rapida = comLock("B", () => {
      ordem.push("B");
    });

    await Promise.all([lenta, rapida]);
    expect(ordem).toEqual(["B", "A"]);
  });

  it("não deixa vazar entradas no mapa depois que a tarefa termina (sucesso)", async () => {
    const { comLock, tamanho } = criarLockPorChave();
    await comLock("123", () => "ok");
    expect(tamanho()).toBe(0);
  });

  it("não deixa vazar entradas no mapa depois que a tarefa termina (falha)", async () => {
    const { comLock, tamanho } = criarLockPorChave();
    await expect(
      comLock("123", () => {
        throw new Error("falhou de propósito");
      }),
    ).rejects.toThrow("falhou de propósito");
    expect(tamanho()).toBe(0);
  });

  it("mantém a entrada no mapa enquanto ainda há tarefa em andamento pra chave", async () => {
    const { comLock, tamanho } = criarLockPorChave();
    const emAndamento = comLock("123", async () => {
      await esperar(20);
    });
    expect(tamanho()).toBe(1);
    await emAndamento;
    expect(tamanho()).toBe(0);
  });

  it("propaga o valor de retorno e o erro de cada tarefa pro chamador correspondente", async () => {
    const { comLock } = criarLockPorChave();
    await expect(comLock("123", () => 42)).resolves.toBe(42);
    await expect(
      comLock("123", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
