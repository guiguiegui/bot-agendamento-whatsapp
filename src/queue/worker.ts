import { Worker } from "bullmq";
import { processarComandoAdmin } from "../commands/admin.js";
import type { AgendaPort, RelatorioPort } from "../conversation/ports.js";
import { processarMensagem } from "../conversation/router.js";
import type { Negocio } from "../domain/negocio.js";
import type { IMessagingClient } from "../whatsapp/types.js";
import { criarLockPorChave } from "../utils/lockPorChave.js";
import { logger } from "../utils/logger.js";
import { registrarProcessamento } from "../utils/metricas.js";
import { NOME_FILA_MENSAGENS, conexaoRedis, type JobMensagemEntrada } from "./queue.js";
import { SessionStoreRedis } from "./sessionStore.js";

export interface RegistroNegocio {
  negocio: Negocio;
  porta: AgendaPort;
  relatorios: RelatorioPort;
  cliente: IMessagingClient;
}

/**
 * Worker único, compartilhado entre todos os negócios ativos — cada job da
 * fila já vem marcado com `negocioId` (ver whatsapp/client.ts), e o
 * processor resolve o registro certo (porta, mensageria, config) antes de
 * processar. Mais simples de operar do que uma fila/worker por negócio, e
 * suficiente na escala que esse bot atende.
 */
export function iniciarWorker(registros: Map<string, RegistroNegocio>): Worker {
  const sessoes = new SessionStoreRedis(conexaoRedis);
  // Evita que duas mensagens seguidas do mesmo cliente, do mesmo negócio,
  // (ex: ele manda "1" duas vezes rápido) leiam e regravem o estado da
  // conversa fora de ordem.
  const { comLock: comLockDoTelefone } = criarLockPorChave();

  const worker = new Worker<JobMensagemEntrada>(
    NOME_FILA_MENSAGENS,
    async (job) => {
      const { negocioId, telefone, texto } = job.data;
      const registro = registros.get(negocioId);
      if (!registro) {
        logger.error({ negocioId, telefone }, "Job de um negócio desconhecido ou inativo — descartando");
        return;
      }
      const { negocio, porta, relatorios, cliente } = registro;
      const log = logger.child({ negocioId, telefone, jobId: job.id });
      const inicio = Date.now();

      try {
        await comLockDoTelefone(`${negocioId}:${telefone}`, async () => {
          if (negocio.numerosAdmin.includes(telefone) && texto.trim().startsWith("/")) {
            const respostaAdmin = await processarComandoAdmin(texto, relatorios, negocio.catalogoServicos);
            if (respostaAdmin) {
              await cliente.enviarTexto(telefone, respostaAdmin);
              return;
            }
          }

          const contextoAtual = await sessoes.obter(negocioId, telefone);
          const resposta = await processarMensagem(texto, contextoAtual, telefone, porta, negocio);
          await sessoes.salvar(negocioId, telefone, resposta.contexto);

          for (const mensagem of resposta.mensagens) {
            await cliente.enviarTexto(telefone, mensagem);
          }
        });
        const duracaoMs = Date.now() - inicio;
        registrarProcessamento(duracaoMs, true);
        log.debug({ duracaoMs }, "mensagem processada");
      } catch (erro) {
        registrarProcessamento(Date.now() - inicio, false);
        throw erro; // preserva o retry automático do BullMQ e o log em worker.on("failed") abaixo
      }
    },
    { connection: conexaoRedis, concurrency: 5 },
  );

  worker.on("failed", (job, erro) => {
    logger.error(
      { erro, jobId: job?.id, negocioId: job?.data.negocioId, telefone: job?.data.telefone },
      "Falha ao processar mensagem da fila",
    );
  });

  return worker;
}
