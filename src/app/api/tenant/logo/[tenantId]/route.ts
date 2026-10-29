import { prisma } from "@/lib/prisma";

// Entrega o logo da estetica gravado pelo POST de /api/tenant/logo. Publico
// de proposito: a tela de login mostra o logo antes de existir sessao.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const logo = await prisma.logoTenant.findUnique({ where: { tenantId } });
  if (!logo) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(logo.dados), {
    headers: {
      "Content-Type": logo.tipo,
      // O endereco carrega ?v=<versao>, trocada a cada envio — o conteudo de
      // um mesmo endereco nunca muda, entao o navegador pode guardar para
      // sempre e nao bater no banco a cada pagina.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
