import { NextResponse } from "next/server";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { hashDoToken } from "@/back/token-email";

// O link do e-mail de confirmacao (ver back/confirmacao-email.ts). Confirma e
// leva ao Perfil, que mostra o resultado: ?email=confirmado ou
// ?email=link-invalido (vencido, ja usado ou de outra estetica).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const token = url.searchParams.get("token") ?? "";
  // O endereco publico do site, e nao o do pedido: na Azure o servidor recebe
  // o pedido como http://0.0.0.0:8080, e voltar para la deixava o cliente numa
  // pagina de erro. O NEXTAUTH_URL e o mesmo endereco que o login ja usa.
  const site = process.env.NEXTAUTH_URL ?? url.origin;
  // O dono (ADMIN) volta para o Dashboard; o cliente, para o Perfil.
  const voltar = (resultado: "confirmado" | "link-invalido", dono = false) =>
    NextResponse.redirect(
      new URL(`/${encodeURIComponent(slug)}/${dono ? "admin" : "perfil"}?email=${resultado}`, site)
    );

  const tenant = slug ? await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }) : null;
  if (!tenant || !token) return voltar("link-invalido");

  const agora = new Date();
  const { confirmou, dono } = await withTenant(tenant.id, async (tx) => {
    // O RLS ja esconde o link de outra estetica; o tenantId repete a regra.
    const pedido = await tx.tokenEmail.findUnique({
      where: { tokenHash: hashDoToken(token) },
      include: { usuario: { select: { role: true } } },
    });
    const dono = pedido?.usuario.role === "ADMIN";
    if (
      !pedido ||
      pedido.tenantId !== tenant.id ||
      pedido.tipo !== "CONFIRMAR_EMAIL" ||
      pedido.usadoEm !== null ||
      pedido.expiraEm <= agora
    ) {
      return { confirmou: false, dono };
    }
    await tx.usuario.update({ where: { id: pedido.usuarioId }, data: { emailConfirmadoEm: agora } });
    await tx.tokenEmail.updateMany({
      where: { usuarioId: pedido.usuarioId, tipo: "CONFIRMAR_EMAIL", usadoEm: null },
      data: { usadoEm: agora },
    });
    return { confirmou: true, dono };
  });

  return voltar(confirmou ? "confirmado" : "link-invalido", dono);
}
