import type { Redis } from "ioredis";
import { CONTEXTO_INICIAL, type SessaoContexto } from "../conversation/states.js";

const PREFIXO_CHAVE = "sessao:";
// Depois de 6h sem mensagens, a conversa "esquece" o estado e volta pro menu
// na próxima interação — evita que alguém fique preso num fluxo de dias atrás.
const TTL_SEGUNDOS = 60 * 60 * 6;

/**
 * Guarda o estado da conversa de cada telefone no Redis (não em memória do
 * processo Node): o bot pode reiniciar ou rodar em mais de uma instância sem
 * que o cliente perca o passo em que estava no meio de um agendamento.
 */
export class SessionStoreRedis {
  constructor(private readonly redis: Redis) {}

  async obter(telefone: string): Promise<SessaoContexto> {
    const bruto = await this.redis.get(PREFIXO_CHAVE + telefone);
    if (!bruto) return CONTEXTO_INICIAL;
    try {
      return JSON.parse(bruto) as SessaoContexto;
    } catch {
      return CONTEXTO_INICIAL;
    }
  }

  async salvar(telefone: string, contexto: SessaoContexto): Promise<void> {
    await this.redis.set(PREFIXO_CHAVE + telefone, JSON.stringify(contexto), "EX", TTL_SEGUNDOS);
  }
}
