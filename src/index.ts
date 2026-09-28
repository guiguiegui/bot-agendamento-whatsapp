import { config } from "./config.js";
import { AgendaRepositorySqlite } from "./db/agendaRepository.js";
import { abrirBanco } from "./db/database.js";
import { NegocioRepository } from "./db/negocioRepository.js";
import { iniciarWorker, type RegistroNegocio } from "./queue/worker.js";
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

  const negocios = new NegocioRepository(db).listarAtivos();
  if (negocios.length === 0) {
    throw new Error("Nenhum negócio ativo cadastrado — rode as migrações (npm run db:migrate) ou verifique o banco.");
  }

  // Uma conexão Baileys por negócio ativo — cada uma com sua própria pasta
  // de sessão, compartilhando o mesmo worker e a mesma fila (ver
  // queue/worker.ts).
  const registros = new Map<string, RegistroNegocio>();
  const clientesWhatsapp: BaileysMessagingClient[] = [];
  for (const negocio of negocios) {
    const porta = new AgendaRepositorySqlite(db, negocio.id);
    const cliente = new BaileysMessagingClient(negocio.id, negocio.whatsappAuthDir);
    registros.set(negocio.id, { negocio, porta, relatorios: porta, cliente });
    clientesWhatsapp.push(cliente);
  }

  const worker = iniciarWorker(registros);

  await Promise.all(clientesWhatsapp.map((cliente) => cliente.conectar()));

  logger.info({ negocios: negocios.length }, "Bot de agendamento no ar. Aguardando mensagens...");

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
