// RF08, RF09, RN13 — Telegram e acionado apenas se o cliente tiver
// telegram_chat_id (verificado pelo chamador). Sem TELEGRAM_BOT_TOKEN
// configurado, registra em log (modo dev/sem bot ainda).
export async function enviarTelegram(chatId: string, texto: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log(`[telegram:LOG] Para chat_id ${chatId}: ${texto}`);
    return { enviado: true, modo: "log" as const };
  }

  const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
  const json = await resposta.json();

  if (!json.ok) {
    console.error("[telegram:ERRO]", json.description);
    return { enviado: false, modo: "bot" as const, erro: json.description as string };
  }
  return { enviado: true, modo: "bot" as const };
}
