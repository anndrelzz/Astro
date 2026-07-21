import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantConfigSchema } from "@/lib/validations/tenant";

// RF17, RF18, RN06 — Admin configura chave PIX, janela de cancelamento,
// capacidade simultanea e intervalo de horarios da propria estetica.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = tenantConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const { pixChaveCopiaCola, ...resto } = parsed.data;

  const tenant = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      ...resto,
      // RN10 — string vazia equivale a "sem chave configurada".
      pixChaveCopiaCola: pixChaveCopiaCola?.length ? pixChaveCopiaCola : null,
    },
  });

  return NextResponse.json(tenant);
}
