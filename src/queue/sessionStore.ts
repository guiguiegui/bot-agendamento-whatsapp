import type { Redis } from "ioredis";
import { CONTEXTO_INICIAL, pareceSessaoValida, type SessaoContexto } from "../conversation/states.js";
import { logger } from "../utils/logger.js";

const PREFIXO_CHAVE = "sessao:";
// Depois de 6h sem mensagens, a conversa "esquece" o estado e volta pro menu
// na próxima interação — evita que alguém fique preso num fluxo de dias atrás.
const TTL_SEGUNDOS = 60 * 60 * 6;

/**
 * Guarda o estado da conversa de cada telefone no Redis (não em memória do
 * processo Node): o bot pode reiniciar ou rodar em mais de uma instância sem
 * que o cliente perca o passo em que estava no meio de um agendamento.
 *
 * Chave inclui `negocioId` — o mesmo telefone pode estar em conversas
 * independentes com negócios diferentes.
 */
export class SessionStoreRedis {
  constructor(private readonly redis: Redis) {}

  async obter(negocioId: string, telefone: string): Promise<SessaoContexto> {
    const bruto = await this.redis.get(`${PREFIXO_CHAVE}${negocioId}:${telefone}`);
    if (!bruto) return CONTEXTO_INICIAL;

    let valor: unknown;
    try {
      valor = JSON.parse(bruto);
    } catch (erro) {
      logger.warn({ erro, negocioId, telefone }, "Sessão salva no Redis não é um JSON válido — reiniciando pro menu");
      return CONTEXTO_INICIAL;
    }

    if (!pareceSessaoValida(valor)) {
      logger.warn({ negocioId, telefone }, "Sessão salva no Redis não tem o formato esperado — reiniciando pro menu");
      return CONTEXTO_INICIAL;
    }

    return valor;
  }

  async salvar(negocioId: string, telefone: string, contexto: SessaoContexto): Promise<void> {
    await this.redis.set(`${PREFIXO_CHAVE}${negocioId}:${telefone}`, JSON.stringify(contexto), "EX", TTL_SEGUNDOS);
  }
}
