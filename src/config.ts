import "dotenv/config";

// Todo o cálculo de horário de funcionamento e agendamento (src/domain) usa
// Date local (getDay/getHours) — sem isso, rodar num servidor com outro fuso
// (ex: UTC, comum em VPS/containers) desloca o expediente inteiro. O
// Dockerfile e o docker-compose já fixam TZ explicitamente; isso aqui é só
// uma rede de segurança pra quem rodar `npm start` fora do Docker sem
// configurar o fuso do sistema.
process.env.TZ ??= "America/Sao_Paulo";

/**
 * Erro de configuração inválida detectada no boot. Separado de outras falhas
 * de inicialização (ex: banco corrompido, Redis fora do ar) porque o reparo
 * é sempre o mesmo: corrigir uma variável de ambiente, não investigar infra.
 */
export class ErroDeConfiguracao extends Error {}

/**
 * Valida o formato de REDIS_URL antes de tentar conectar. Sem isso, uma URL
 * mal formatada (ex: esqueceu o "redis://", ou colou a URL de outro serviço)
 * não falha aqui — o ioredis só fica tentando (e falhando) reconectar
 * indefinidamente, sem nenhuma mensagem que aponte pra causa real.
 */
function validarRedisUrl(url: string): string {
  if (!/^rediss?:\/\/\S+$/.test(url)) {
    throw new ErroDeConfiguracao(
      `REDIS_URL inválida: "${url}". Esperado algo como "redis://host:porta" (ou "rediss://" pra TLS).`,
    );
  }
  return url;
}

/**
 * Valida que cada número em ADMIN_PHONE_NUMBERS é só dígitos (formato
 * internacional: DDI+DDD+número, sem "+", espaço ou hífen). Sem essa
 * checagem, um número digitado com formatação nunca bate com o telefone que
 * chega da Baileys (já normalizado só-dígitos) — o comando de admin some
 * silenciosamente, sem nenhum erro que aponte o motivo.
 */
function validarNumerosAdmin(bruto: string): string[] {
  const numeros = bruto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const numero of numeros) {
    if (!/^\d+$/.test(numero)) {
      throw new ErroDeConfiguracao(
        `ADMIN_PHONE_NUMBERS contém um valor inválido: "${numero}". Esperado só dígitos ` +
          `(DDI+DDD+número, ex: "5519991234567"), sem "+", espaço ou hífen.`,
      );
    }
  }

  return numeros;
}

/**
 * Valida que uma variável de porta é um inteiro válido (1-65535) antes de
 * tentar abrir um servidor nela — sem isso, um valor mal formatado só falha
 * lá na hora do `server.listen()`, com um erro genérico do Node.
 */
function validarPorta(bruto: string, nomeVar: string): number {
  const porta = Number(bruto);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
    throw new ErroDeConfiguracao(`${nomeVar} inválida: "${bruto}". Esperado um número de porta entre 1 e 65535.`);
  }
  return porta;
}

export const config = {
  databasePath: process.env.DATABASE_PATH ?? "./data/bot.db",
  redisUrl: validarRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
  whatsappAuthDir: process.env.WHATSAPP_AUTH_DIR ?? "./data/auth",
  /** Números (formato internacional, só dígitos) autorizados a usar comandos de admin, ex: "5519991234567". */
  numerosAdmin: validarNumerosAdmin(process.env.ADMIN_PHONE_NUMBERS ?? ""),
  logLevel: process.env.LOG_LEVEL ?? "info",
  /** Porta do servidor HTTP de health-check/métricas (ver src/health.ts). */
  healthPort: validarPorta(process.env.HEALTH_PORT ?? "3000", "HEALTH_PORT"),
};
