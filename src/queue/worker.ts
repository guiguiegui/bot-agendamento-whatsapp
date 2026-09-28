import { Worker } from "bullmq";
import { config } from "../config.js";
import { processarComandoAdmin } from "../commands/admin.js";
import type { AgendaPort, RelatorioPort } from "../conversation/ports.js";
import { processarMensagem } from "../conversation/router.js";
import type { IMessagingClient } from "../whatsapp/types.js";
import { logger } from "../utils/logger.js";
import { NOME_FILA_MENSAGENS, conexaoRedis, type JobMensagemEntrada } from "./queue.js";
import { SessionStoreRedis } from "./sessionStore.js";

const bloqueiosPorTelefone = new Map<string, Promise<unknown>>();

/**
 * Serializa o processamento de mensagens de um MESMO telefone: evita que duas
 * mensagens seguidas do mesmo cliente (ex: ele manda "1" duas vezes rápido)
 * leiam e regravem o estado da conversa fora de ordem.
 *
 * Isso é um lock em memória do processo — correto porque rodamos um único
 * worker por instância (ver docker-compose.yml). Escalando pra mais de uma
 * instância do worker, troque por um lock distribuído (ex: `SET chave valor
 * NX PX 5000` no Redis) usando o telefone como chave.
 */
function comLockDoTelefone<T>(telefone: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = bloqueiosPorTelefone.get(telefone) ?? Promise.resolve();
  const proxima = anterior.then(tarefa, tarefa);
  bloqueiosPorTelefone.set(
    telefone,
    proxima.then(
      () => undefined,
      () => undefined,
    ),
  );
  return proxima;
}

export function iniciarWorker(porta: AgendaPort, relatorios: RelatorioPort, cliente: IMessagingClient): Worker {
  const sessoes = new SessionStoreRedis(conexaoRedis);

  const worker = new Worker<JobMensagemEntrada>(
    NOME_FILA_MENSAGENS,
    async (job) => {
      const { telefone, texto } = job.data;

      await comLockDoTelefone(telefone, async () => {
        if (config.numerosAdmin.includes(telefone) && texto.trim().startsWith("/")) {
          const respostaAdmin = await processarComandoAdmin(texto, relatorios);
          if (respostaAdmin) {
            await cliente.enviarTexto(telefone, respostaAdmin);
            return;
          }
        }

        const contextoAtual = await sessoes.obter(telefone);
        const resposta = await processarMensagem(texto, contextoAtual, telefone, porta);
        await sessoes.salvar(telefone, resposta.contexto);

        for (const mensagem of resposta.mensagens) {
          await cliente.enviarTexto(telefone, mensagem);
        }
      });
    },
    { connection: conexaoRedis, concurrency: 5 },
  );

  worker.on("failed", (job, erro) => {
    logger.error({ erro, jobId: job?.id, telefone: job?.data.telefone }, "Falha ao processar mensagem da fila");
  });

  return worker;
}
