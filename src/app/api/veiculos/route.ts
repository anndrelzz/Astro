import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { veiculoSchema } from "@/lib/validations/veiculo";

// UC02 — cadastro de veiculo, obrigatorio antes do primeiro agendamento (RN04).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = veiculoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const veiculo = await prisma.veiculo.create({
    data: {
      ...parsed.data,
      usuarioId: session.user.id,
    },
  });

  return NextResponse.json(veiculo, { status: 201 });
}

// RF15 — historico de veiculos do cliente autenticado.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const veiculos = await prisma.veiculo.findMany({
    where: { usuarioId: session.user.id },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(veiculos);
}
