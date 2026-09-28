import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

// `maxRetriesPerRequest: null` é exigido pelo BullMQ pra conexões usadas em filas/workers.
export const conexaoRedis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export const NOME_FILA_MENSAGENS = "whatsapp-mensagens";

export interface JobMensagemEntrada {
  negocioId: string;
  telefone: string;
  texto: string;
  recebidoEm: string;
}

export const filaMensagens = new Queue<JobMensagemEntrada>(NOME_FILA_MENSAGENS, {
  connection: conexaoRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});
