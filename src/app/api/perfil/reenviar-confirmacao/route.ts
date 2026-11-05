import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/back/auth";
import { criarLinkDeConfirmacao, enviarLinkDeConfirmacao } from "@/back/confirmacao-email";
import { withTenant } from "@/back/tenant-db";

// O "Reenviar e-mail de confirmacao" do Perfil: um link novo para quem ainda
// nao confirmou, no maximo 3 por hora (contando o do cadastro).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const resultado = await withTenant(session.user.tenantId, async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: { id: session.user.id },
      include: { tenant: { select: { nome: true, slug: true, logoUrl: true } } },
    });
    if (!usuario) return { status: 404, error: "Conta nao encontrada" } as const;
    if (usuario.emailConfirmadoEm) return { status: 409, error: "Seu e-mail já está confirmado." } as const;

    const link = await criarLinkDeConfirmacao(tx, usuario, usuario.tenant.slug);
    if (!link) {
      return { status: 429, error: "Você já pediu 3 links na última hora. Tente de novo mais tarde." } as const;
    }
    return { usuario, link } as const;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }
  await enviarLinkDeConfirmacao(resultado.usuario, resultado.usuario.tenant, resultado.link);
  return NextResponse.json({ ok: true });
}
