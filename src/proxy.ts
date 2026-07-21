import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// RN02 — acesso aos servicos da estetica exige autenticacao; cliente nao
// autenticado e redirecionado para a tela de login DAQUELA estetica
// (astro.app/[slug]/login), nao uma tela generica.
export default async function proxy(req: NextRequest) {
  const token = await getToken({ req });
  if (token) return NextResponse.next();

  const slug = req.nextUrl.pathname.split("/")[1];
  const loginUrl = new URL(`/${slug}/login`, req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protege as rotas de agendamento, veiculos, historico e admin de cada tenant.
  matcher: [
    "/:slug/agendar/:path*",
    "/:slug/veiculos/:path*",
    "/:slug/historico/:path*",
    "/:slug/admin/:path*",
  ],
};
