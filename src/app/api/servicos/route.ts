import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { servicoSchema } from "@/lib/validations/servico";

// UC08, RF01 — Admin cadastra servicos com preco por segmento de veiculo.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = servicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const servico = await prisma.servico.create({
    data: { ...parsed.data, tenantId: session.user.tenantId },
  });

  return NextResponse.json(servico, { status: 201 });
}
