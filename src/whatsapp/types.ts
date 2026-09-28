/**
 * Abstração sobre "enviar uma mensagem de texto pra alguém". O worker e o
 * router não sabem (nem precisam saber) que por baixo existe Baileys — isso
 * torna possível testar toda a lógica de conversa sem nunca abrir uma
 * conexão de verdade com o WhatsApp.
 */
export interface IMessagingClient {
  enviarTexto(telefone: string, texto: string): Promise<void>;
}
