import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// UC15, RN12 — gera um TOKEN temporario associado a conta do cliente,
// usado no link t.me/<bot>?start=TOKEN. Invalidado apos a vinculacao.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const token = randomUUID();
  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { telegramLinkToken: token },
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "AstroBot";
  const link = `https://t.me/${botUsername}?start=${token}`;

  return NextResponse.json({ link });
}
