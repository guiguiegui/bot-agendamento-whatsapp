import { config } from "./config.js";
import { AgendaRepositorySqlite } from "./db/agendaRepository.js";
import { abrirBanco } from "./db/database.js";
import { iniciarWorker } from "./queue/worker.js";
import { logger } from "./utils/logger.js";
import { BaileysMessagingClient } from "./whatsapp/client.js";

async function main(): Promise<void> {
  const db = abrirBanco(config.databasePath);
  const repositorio = new AgendaRepositorySqlite(db);

  const clienteWhatsapp = new BaileysMessagingClient();
  const worker = iniciarWorker(repositorio, repositorio, clienteWhatsapp);

  await clienteWhatsapp.conectar();

  logger.info("Bot de agendamento no ar. Aguardando mensagens...");

  const encerrar = async (sinal: string) => {
    logger.info({ sinal }, "Encerrando...");
    await worker.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void encerrar("SIGINT"));
  process.on("SIGTERM", () => void encerrar("SIGTERM"));
}

main().catch((erro) => {
  logger.error({ erro }, "Falha fatal ao iniciar o bot");
  process.exit(1);
});
