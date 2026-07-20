import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// RN02 — acesso aos servicos da estetica exige autenticacao; cliente nao
// autenticado e redirecionado para a tela de login ao acessar a URL do tenant.
// (Convencao "proxy" — substitui "middleware", renomeado a partir do Next.js 16)
export default withAuth(
  function proxy() {
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Protege as rotas de tenant ([slug]/...) e o painel admin.
  // Login, cadastro e a landing institucional ficam de fora.
  matcher: ["/:slug/agendar/:path*", "/:slug/historico/:path*", "/:slug/admin/:path*"],
};
