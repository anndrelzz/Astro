import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { withTenant } from "@/lib/tenant-db";
import { validarPrecosCompletos } from "@/lib/catalogo";
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

  const tenantId = session.user.tenantId;
  const { precos, ...dadosServico } = parsed.data;

  const resultado = await withTenant(tenantId, async (tx) => {
    const problema = await validarPrecosCompletos(tx, tenantId, precos);
    if (problema) return { error: problema, status: 400 } as const;

    const servico = await tx.servico.create({
      data: {
        ...dadosServico,
        tenantId,
        precos: {
          create: precos.map((p) => ({
            tenantId,
            segmentoId: p.segmentoId,
            valor: p.valor,
          })),
        },
      },
      include: { precos: true },
    });

    return { servico } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json(resultado.servico, { status: 201 });
}
