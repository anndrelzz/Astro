import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";
import { veiculoSchema } from "@/lib/validations/veiculo";

// UC02 — cadastro de veiculo, obrigatorio antes do primeiro agendamento (RN04).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = veiculoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const veiculo = await withTenant(session.user.tenantId, (tx) =>
    tx.veiculo.create({
      data: {
        ...parsed.data,
        tenantId: session.user.tenantId,
        usuarioId: session.user.id,
      },
    })
  );

  return NextResponse.json(veiculo, { status: 201 });
}

// RF15 — veiculos do cliente autenticado. RN15: aposentados ficam de fora;
// eles so continuam visiveis dentro do historico dos agendamentos antigos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const veiculos = await withTenant(session.user.tenantId, (tx) =>
    tx.veiculo.findMany({
      where: { usuarioId: session.user.id, ativo: true },
      orderBy: { id: "asc" },
    })
  );

  return NextResponse.json(veiculos);
}
