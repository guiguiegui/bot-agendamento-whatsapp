/**
 * Smoke test de ponta a ponta: fila real (BullMQ) + Redis real + SQLite real,
 * só substituindo o WhatsApp por um cliente falso que guarda as mensagens
 * enviadas. Roda um fluxo completo de agendamento e confere o resultado.
 *
 * Não faz parte do `npm test` (não tem Redis no CI) — rode manualmente com
 * `npm run smoke` tendo um Redis local ligado (REDIS_URL no .env).
 */
import { setTimeout as esperar } from "node:timers/promises";
import { AgendaRepositorySqlite } from "../src/db/agendaRepository.js";
import { abrirBanco } from "../src/db/database.js";
import { NegocioRepository } from "../src/db/negocioRepository.js";
import { conexaoRedis, filaMensagens } from "../src/queue/queue.js";
import { iniciarWorker, type RegistroNegocio } from "../src/queue/worker.js";
import type { IMessagingClient } from "../src/whatsapp/types.js";

const TELEFONE = "5519990000000";

class ClienteFalso implements IMessagingClient {
  mensagens: string[] = [];
  async enviarTexto(_telefone: string, texto: string): Promise<void> {
    this.mensagens.push(texto);
  }
}

async function enviar(negocioId: string, texto: string): Promise<void> {
  await filaMensagens.add("mensagem-recebida", {
    negocioId,
    telefone: TELEFONE,
    texto,
    recebidoEm: new Date().toISOString(),
  });
}

/** Acha a próxima terça-feira a partir de hoje (dia de funcionamento garantido) e formata dd/mm. */
function proximaTercaFormatada(): string {
  const hoje = new Date();
  const diasAteTerca = (2 - hoje.getDay() + 7) % 7 || 7;
  const data = new Date(hoje);
  data.setDate(hoje.getDate() + diasAteTerca);
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const db = abrirBanco(":memory:");
  const negocio = new NegocioRepository(db).listarAtivos()[0];
  if (!negocio) throw new Error("Nenhum negócio ativo seedado — smoke test não pode continuar.");
  const repo = new AgendaRepositorySqlite(db, negocio.id);
  const cliente = new ClienteFalso();
  const registros = new Map<string, RegistroNegocio>([
    [negocio.id, { negocio, porta: repo, relatorios: repo, cliente }],
  ]);
  const worker = iniciarWorker(registros);

  // agendar -> corte -> próxima terça (dia útil garantido) -> primeiro horário
  const passos = ["1", "1", proximaTercaFormatada(), "1"];
  for (const passo of passos) {
    await enviar(negocio.id, passo);
    await esperar(300); // dá tempo do worker processar antes do próximo passo
  }

  console.log("--- mensagens enviadas pelo bot ---");
  cliente.mensagens.forEach((m, i) => console.log(`[${i}]`, m.replace(/\n/g, " ⏎ ")));

  const agendamentosFuturos = await repo.listarAgendamentosFuturosDoCliente(TELEFONE, new Date(0));
  console.log("--- agendamentos persistidos ---", agendamentosFuturos.length);

  const confirmou = cliente.mensagens.some((m) => /agendamento confirmado/i.test(m));
  if (!confirmou || agendamentosFuturos.length !== 1) {
    console.error("SMOKE TEST FALHOU");
    process.exitCode = 1;
  } else {
    console.log("SMOKE TEST OK ✅");
  }

  await worker.close();
  await conexaoRedis.quit();
  db.close();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
