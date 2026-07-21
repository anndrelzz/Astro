import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/notificacoes/telegram";

// UC15, RN12 — recebe o update do Telegram quando o cliente toca em
// "START" apos abrir t.me/<bot>?start=TOKEN. Associa o chat_id a conta
// correspondente e invalida o token imediatamente.
export async function POST(request: Request) {
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

  const usuario = await prisma.usuario.findFirst({
    where: { telegramLinkToken: token },
  });

  if (!usuario) {
    return NextResponse.json({ ok: true });
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { telegramChatId: String(chatId), telegramLinkToken: null },
  });

  await enviarTelegram(String(chatId), "Conta vinculada com sucesso!");

  return NextResponse.json({ ok: true });
}
