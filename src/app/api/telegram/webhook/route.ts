import { NextResponse } from "next/server";
import { withTelegramTokenLookup, withTenant } from "@/back/tenant-db";
import { enviarTelegram } from "@/back/notificacoes/telegram";

// UC15, RN12 — recebe o update do Telegram quando o cliente toca em
// "START" apos abrir t.me/<bot>?start=TOKEN. Associa o chat_id a conta
// correspondente e invalida o token imediatamente.
//
// O endereco e publico: qualquer um pode mandar um POST para ele. Para saber
// que o update veio mesmo do Telegram, o setWebhook registra um segredo
// (secret_token) e o Telegram o devolve em todo update, no cabecalho
// X-Telegram-Bot-Api-Secret-Token. Falha fechada, como o cron: sem
// TELEGRAM_WEBHOOK_SECRET configurado, nada e aceito.
export async function POST(request: Request) {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!esperado) {
    console.error(
      "[telegram/webhook] TELEGRAM_WEBHOOK_SECRET nao configurado - rota recusada por seguranca"
    );
    return NextResponse.json(
      { error: "Webhook nao configurado neste ambiente" },
      { status: 503 }
    );
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== esperado) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    // Endpoint publico (chamado pelo Telegram) - corpo invalido nao deve
    // derrubar o servidor, so nao ha nada a fazer.
    return NextResponse.json({ ok: true });
  }

  const mensagem = (update as { message?: { text?: string; chat?: { id?: number } } })
    ?.message;
  const texto = mensagem?.text;
  const chatId = mensagem?.chat?.id;

  if (!texto?.startsWith("/start ") || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const token = texto.replace("/start ", "").trim();
  if (!token) {
    return NextResponse.json({ ok: true });
  }

  const usuario = await withTelegramTokenLookup(token, (tx) =>
    tx.usuario.findFirst({
      where: { telegramLinkToken: token },
    })
  );

  if (!usuario) {
    return NextResponse.json({ ok: true });
  }

  await withTenant(usuario.tenantId, (tx) =>
    tx.usuario.update({
      where: { id: usuario.id },
      data: { telegramChatId: String(chatId), telegramLinkToken: null },
    })
  );

  await enviarTelegram(String(chatId), "Conta vinculada com sucesso!");

  return NextResponse.json({ ok: true });
}
