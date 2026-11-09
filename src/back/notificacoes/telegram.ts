import "server-only";
import { registrarFalha } from "@/back/log-de-erro";
import type { BotaoTelegram } from "@/back/notificacoes/modelo-telegram";

// RF08, RF09, RN13 — Telegram e acionado apenas se o cliente tiver
// telegram_chat_id (verificado pelo chamador). Sem TELEGRAM_BOT_TOKEN
// configurado, registra em log (modo dev/sem bot ainda).
//
// O texto vai em HTML simples (<b>, <i>), e os botoes, embaixo da mensagem,
// abrem links. A previa do link fica desligada: sem ela, o cartao do site
// apareceria embaixo de toda mensagem.
export async function enviarTelegram(chatId: string, texto: string, { botoes = [] }: { botoes?: BotaoTelegram[] } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log(`[telegram:LOG] Para chat_id ${chatId}: ${texto}`);
    return { enviado: true, modo: "log" as const };
  }

  const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(botoes.length > 0
        ? { reply_markup: { inline_keyboard: [botoes.map((b) => ({ text: b.texto, url: b.url }))] } }
        : {}),
    }),
  });
  const json = await resposta.json();

  if (!json.ok) {
    registrarFalha("[telegram:ERRO]", new Error(json.description));
    return { enviado: false, modo: "bot" as const, erro: json.description as string };
  }
  return { enviado: true, modo: "bot" as const };
}
