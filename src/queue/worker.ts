import { Worker } from "bullmq";
import { processarComandoAdmin } from "../commands/admin.js";
import type { AgendaPort, RelatorioPort } from "../conversation/ports.js";
import { processarMensagem } from "../conversation/router.js";
import type { Negocio } from "../domain/negocio.js";
import type { IMessagingClient } from "../whatsapp/types.js";
import { criarLockPorChave } from "../utils/lockPorChave.js";
import { logger } from "../utils/logger.js";
import { NOME_FILA_MENSAGENS, conexaoRedis, type JobMensagemEntrada } from "./queue.js";
import { SessionStoreRedis } from "./sessionStore.js";

export function iniciarWorker(
  porta: AgendaPort,
  relatorios: RelatorioPort,
  cliente: IMessagingClient,
  negocio: Negocio,
): Worker {
  const sessoes = new SessionStoreRedis(conexaoRedis);
  // Evita que duas mensagens seguidas do mesmo cliente (ex: ele manda "1"
  // duas vezes rápido) leiam e regravem o estado da conversa fora de ordem.
  const { comLock: comLockDoTelefone } = criarLockPorChave();

  const worker = new Worker<JobMensagemEntrada>(
    NOME_FILA_MENSAGENS,
    async (job) => {
      const { telefone, texto } = job.data;

      await comLockDoTelefone(telefone, async () => {
        if (negocio.numerosAdmin.includes(telefone) && texto.trim().startsWith("/")) {
          const respostaAdmin = await processarComandoAdmin(texto, relatorios, negocio.catalogoServicos);
          if (respostaAdmin) {
            await cliente.enviarTexto(telefone, respostaAdmin);
            return;
          }
        }

        const contextoAtual = await sessoes.obter(telefone);
        const resposta = await processarMensagem(texto, contextoAtual, telefone, porta, negocio);
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
