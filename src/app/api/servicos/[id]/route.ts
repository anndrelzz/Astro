import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { servicoSchema } from "@/lib/validations/servico";

// UC08 — edicao e remocao de servico, restrito ao Admin da propria estetica.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const servico = await prisma.servico.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!servico) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = servicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const atualizado = await prisma.servico.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(atualizado);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const servico = await prisma.servico.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!servico) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  const agendamentosVinculados = await prisma.agendamento.count({
    where: { servicoId: id },
  });
  if (agendamentosVinculados > 0) {
    return NextResponse.json(
      { error: "Servico possui agendamentos vinculados e nao pode ser removido" },
      { status: 409 }
    );
  }

  await prisma.servico.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
