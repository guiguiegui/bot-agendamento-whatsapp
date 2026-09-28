import { config } from "./config.js";
import { AgendaRepositorySqlite } from "./db/agendaRepository.js";
import { abrirBanco } from "./db/database.js";
import { NegocioRepository } from "./db/negocioRepository.js";
import { iniciarWorker } from "./queue/worker.js";
import { logger } from "./utils/logger.js";
import { BaileysMessagingClient } from "./whatsapp/client.js";

// Rede de segurança pra qualquer promise "solta" sem .catch (ex: os `void
// algo()` na Baileys) que rejeitar sem que nada trate: sem isso, o Node
// derruba o processo sem log nenhum, e o motivo real da queda se perde. O
// container reinicia sozinho (`restart: unless-stopped`), então continuamos
// deixando o processo morrer — só garantindo que o porquê fica registrado.
process.on("unhandledRejection", (erro) => {
  logger.error({ erro }, "Promise rejeitada sem tratamento — encerrando");
  process.exit(1);
});
process.on("uncaughtException", (erro) => {
  logger.error({ erro }, "Exceção não capturada — encerrando");
  process.exit(1);
});

async function main(): Promise<void> {
  const db = abrirBanco(config.databasePath);
  const repositorio = new AgendaRepositorySqlite(db);

  // Enquanto o bot só atende um negócio por instância (multi-conexão é uma
  // evolução futura), usamos o primeiro negócio ativo cadastrado.
  const negocio = new NegocioRepository(db).listarAtivos()[0];
  if (!negocio) {
    throw new Error("Nenhum negócio ativo cadastrado — rode as migrações (npm run db:migrate) ou verifique o banco.");
  }

  const clienteWhatsapp = new BaileysMessagingClient();
  const worker = iniciarWorker(repositorio, repositorio, clienteWhatsapp, negocio);

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
