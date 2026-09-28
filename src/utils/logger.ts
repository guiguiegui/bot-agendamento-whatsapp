import pino from "pino";
import { config } from "../config.js";

/**
 * Logger estruturado (JSON em produção, formatado em dev). O ponto de
 * integração com uma ferramenta de observabilidade (ex: Sentry) é aqui: dá
 * pra plugar um `pino` transport ou um hook em `logger.error` sem tocar no
 * resto do código.
 */
export const logger = pino({
  level: config.logLevel,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
