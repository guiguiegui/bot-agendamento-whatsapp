import "dotenv/config";

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
