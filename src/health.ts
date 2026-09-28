import { createServer, type Server } from "node:http";
import type { Database } from "better-sqlite3";
import type { Redis } from "ioredis";
import { filaMensagens } from "./queue/queue.js";
import { logger } from "./utils/logger.js";
import { obterMetricas } from "./utils/metricas.js";
import { avaliarSaude, montarCorpoMetricas } from "./utils/saude.js";

/**
 * Servidor HTTP mínimo pra orquestrador de container (Docker HEALTHCHECK,
 * Kubernetes liveness/readiness, etc.) e observabilidade básica — não é
 * testado automaticamente (I/O real, e importa filaMensagens de queue.js,
 * que abre conexão com Redis só de ser importado — mesmo tratamento dado a
 * scripts/negocio-cli.ts e scripts/smoke-e2e.ts). A lógica de decisão pura
 * (avaliarSaude/montarCorpoMetricas) mora em utils/saude.ts exatamente pra
 * poder ser testada sem puxar essa conexão.
 *
 * `GET /health`: banco e Redis respondendo → 200, senão 503.
 * `GET /metrics`: contadores em memória (src/utils/metricas.ts) + contagem
 * da fila (BullMQ).
 */
export function iniciarServidorSaude(db: Database, redis: Redis, porta: number): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      let dbOk: boolean;
      try {
        db.prepare("SELECT 1").get();
        dbOk = true;
      } catch {
        dbOk = false;
      }
      // Checa o estado da conexão já existente (sem round-trip novo) — suficiente
      // pra decidir se o processo está pronto pra receber tráfego.
      const redisOk = redis.status === "ready";

      const { saudavel, status } = avaliarSaude(dbOk, redisOk);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: saudavel ? "ok" : "unhealthy", db: dbOk, redis: redisOk }));
      return;
    }

    if (req.url === "/metrics") {
      filaMensagens
        .getJobCounts()
        .then((contagemFila) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(montarCorpoMetricas(obterMetricas(), contagemFila));
        })
        .catch((erro: unknown) => {
          logger.error({ erro }, "Falha ao obter contagem da fila pra /metrics");
          res.writeHead(500);
          res.end();
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(porta, () => {
    logger.info({ porta }, "Servidor de health-check/métricas no ar");
  });

  return server;
}
