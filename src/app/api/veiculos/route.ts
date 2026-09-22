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

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    // Duplicata = todos os campos iguais (marca/modelo/cor sem diferenciar
    // maiuscula/minuscula) num veiculo ativo do mesmo cliente. Uma placa ou
    // cor diferente ja e um veiculo diferente e passa direto.
    const duplicado = await tx.veiculo.findFirst({
      where: {
        usuarioId: session.user.id,
        ativo: true,
        placa: parsed.data.placa,
        ano: parsed.data.ano,
        segmento: parsed.data.segmento,
        marca: { equals: parsed.data.marca, mode: "insensitive" },
        modelo: { equals: parsed.data.modelo, mode: "insensitive" },
        cor: { equals: parsed.data.cor, mode: "insensitive" },
      },
    });
    if (duplicado) {
      return { error: "Voce ja tem esse veiculo cadastrado" } as const;
    }

    const veiculo = await tx.veiculo.create({
      data: {
        ...parsed.data,
        tenantId: session.user.tenantId,
        usuarioId: session.user.id,
      },
    });
    return { veiculo } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 409 });
  }

  return NextResponse.json(resultado.veiculo, { status: 201 });
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
