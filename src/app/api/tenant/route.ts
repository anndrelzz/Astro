import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lerJson } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { tenantConfigSchema } from "@/lib/validations/tenant";

// UC13, UC14, RF13, RF17, RF18, RN06 — Admin configura a propria estetica:
// dados de apresentacao, endereco, contatos, chave PIX, janela de cancelamento,
// capacidade simultanea e intervalo de horarios.
//
// O slug nao e alteravel por aqui: RN09 o define como imutavel apos o cadastro,
// e ele nem consta do schema de validacao.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const body = await lerJson(request);
  if (body === null) {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }
  const parsed = tenantConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
      { status: 400 }
    );
  }

  const { pixChaveCopiaCola, ...resto } = parsed.data;

  // Atualizacao parcial: so entram no update os campos que vieram no corpo.
  // Campo ausente != campo vazio — a tela salva por secao, e salvar o endereco
  // nao pode zerar a chave PIX sem querer.
  const dados: Record<string, unknown> = { ...resto };
  if (pixChaveCopiaCola !== undefined) {
    // RN10 — string vazia equivale a "sem chave configurada".
    dados.pixChaveCopiaCola = pixChaveCopiaCola?.length ? pixChaveCopiaCola : null;
  }

  const tenant = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: dados,
  });

  return NextResponse.json(tenant);
}
