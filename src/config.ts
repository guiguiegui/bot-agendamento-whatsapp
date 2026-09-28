import "dotenv/config";

// Todo o cálculo de horário de funcionamento e agendamento (src/domain) usa
// Date local (getDay/getHours) — sem isso, rodar num servidor com outro fuso
// (ex: UTC, comum em VPS/containers) desloca o expediente inteiro. O
// Dockerfile e o docker-compose já fixam TZ explicitamente; isso aqui é só
// uma rede de segurança pra quem rodar `npm start` fora do Docker sem
// configurar o fuso do sistema.
process.env.TZ ??= "America/Sao_Paulo";

export const config = {
  databasePath: process.env.DATABASE_PATH ?? "./data/bot.db",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  whatsappAuthDir: process.env.WHATSAPP_AUTH_DIR ?? "./data/auth",
  /** Números (formato internacional, só dígitos) autorizados a usar comandos de admin, ex: "5519991234567". */
  numerosAdmin: (process.env.ADMIN_PHONE_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? "info",
};
