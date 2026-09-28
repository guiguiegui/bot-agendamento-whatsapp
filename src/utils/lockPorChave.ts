/**
 * Serializa a execução de tarefas associadas à mesma chave: garante que duas
 * tarefas para a mesma chave nunca rodem fora de ordem, mesmo disparadas
 * concorrentemente. Tarefas de chaves diferentes rodam livres, em paralelo.
 *
 * É um lock em memória do processo — correto quando só existe uma instância
 * do chamador rodando (ver uso em queue/worker.ts). Escalando pra mais de uma
 * instância, troque por um lock distribuído (ex: `SET chave valor NX PX 5000`
 * no Redis).
 *
 * Cada chave só ocupa espaço no mapa enquanto tem uma tarefa em andamento —
 * ao terminar (sucesso ou falha), a chave é removida, evitando um vazamento
 * de memória que cresceria pra cada chave nova vista ao longo da vida do
 * processo.
 */
export function criarLockPorChave() {
  const emAndamento = new Map<string, Promise<unknown>>();

  async function comLock<T>(chave: string, tarefa: () => T | Promise<T>): Promise<T> {
    const anterior = emAndamento.get(chave) ?? Promise.resolve();
    const proxima = anterior.then(tarefa, tarefa);

    const marcador = proxima.then(
      () => undefined,
      () => undefined,
    );
    emAndamento.set(chave, marcador);

    void marcador.finally(() => {
      if (emAndamento.get(chave) === marcador) {
        emAndamento.delete(chave);
      }
    });

    return proxima;
  }

  return { comLock, tamanho: () => emAndamento.size };
}
