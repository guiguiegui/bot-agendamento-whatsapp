import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { filaMensagens } from "../queue/queue.js";
import { logger } from "../utils/logger.js";
import type { IMessagingClient } from "./types.js";

function telefoneParaJid(telefone: string): string {
  return telefone.includes("@") ? telefone : `${telefone}@s.whatsapp.net`;
}

function jidParaTelefone(jid: string): string {
  return jid.split("@")[0] ?? jid;
}

/**
 * Adaptador sobre a Baileys (biblioteca não-oficial de WhatsApp Web
 * multi-device). Ver README.md → "Sobre a biblioteca do WhatsApp" pra
 * entender a troca que essa escolha implica e como migrar pra API oficial
 * (Meta Cloud API) quando o volume/risco justificar.
 *
 * Responsabilidade única: manter a conexão viva e transformar mensagens
 * recebidas em jobs na fila. Toda a lógica de conversa mora em outro lugar.
 *
 * Uma instância = uma conexão = um negócio (`negocioId`), cada um com sua
 * própria pasta de sessão (`authDir`) — é isso que permite vários negócios
 * rodando na mesma instância do bot, cada um com seu próprio WhatsApp.
 */
export class BaileysMessagingClient implements IMessagingClient {
  private socket: WASocket | undefined;

  constructor(
    private readonly negocioId: string,
    private readonly authDir: string,
  ) {}

  async enviarTexto(telefone: string, texto: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Cliente WhatsApp ainda não conectado — mensagem descartada.");
    }
    await this.socket.sendMessage(telefoneParaJid(telefone), { text: texto });
  }

  async conectar(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: logger.child({ modulo: "baileys", negocioId: this.negocioId }),
    });
    this.socket = socket;

    socket.ev.on("creds.update", () => {
      void saveCreds();
    });
    socket.ev.on("connection.update", (update) => this.aoAtualizarConexao(update));
    socket.ev.on("messages.upsert", (evento) => {
      void this.aoReceberMensagens(evento);
    });
  }

  private aoAtualizarConexao(update: {
    connection?: string;
    qr?: string;
    lastDisconnect?: { error?: unknown };
  }): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info(
        { negocioId: this.negocioId },
        "Escaneie o QR code abaixo, no WhatsApp do número deste negócio (Aparelhos conectados):",
      );
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const deveReconectar = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ negocioId: this.negocioId, statusCode, deveReconectar }, "Conexão com o WhatsApp caiu");
      if (deveReconectar) {
        void this.conectar();
      } else {
        logger.error(
          { negocioId: this.negocioId },
          "Sessão desconectada (logout no aparelho). Apague a pasta de auth desse negócio e escaneie o QR de novo.",
        );
      }
    } else if (connection === "open") {
      logger.info({ negocioId: this.negocioId }, "Conectado ao WhatsApp ✅");
    }
  }

  private async aoReceberMensagens(evento: {
    messages: {
      key: { remoteJid?: string | null; fromMe?: boolean | null; id?: string | null };
      message?: {
        conversation?: string | null;
        extendedTextMessage?: { text?: string | null } | null;
        buttonsResponseMessage?: { selectedButtonId?: string | null } | null;
      } | null;
    }[];
    type: string;
  }): Promise<void> {
    if (evento.type !== "notify") return;

    for (const msg of evento.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us")) continue; // não atende grupos, só conversa 1:1

      const texto =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        msg.message.buttonsResponseMessage?.selectedButtonId ??
        "";
      if (!texto.trim()) continue;

      await filaMensagens.add(
        "mensagem-recebida",
        {
          negocioId: this.negocioId,
          telefone: jidParaTelefone(jid),
          texto,
          recebidoEm: new Date().toISOString(),
        },
        // usar o id da mensagem do WhatsApp (prefixado pelo negócio) como
        // jobId evita processar a mesma mensagem duas vezes se a Baileys
        // entregar o evento repetido — e evita colisão entre negócios
        // diferentes no caso (raro) de ids de mensagem iguais.
        { jobId: msg.key.id ? `${this.negocioId}:${msg.key.id}` : undefined },
      );
    }
  }
}
