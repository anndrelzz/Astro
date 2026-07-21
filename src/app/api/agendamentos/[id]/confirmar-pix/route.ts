import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// UC16, RF06 — Admin confirma manualmente o pagamento PIX apos verificar
// o recebimento no app do banco.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const agendamento = await prisma.agendamento.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!agendamento) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }
  if (agendamento.status !== "PIX_PENDENTE") {
    return NextResponse.json(
      { error: "Agendamento nao esta com PIX pendente" },
      { status: 400 }
    );
  }

  await prisma.agendamento.update({
    where: { id },
    data: { status: "CONFIRMADO" },
  });

  return NextResponse.json({ ok: true });
}
