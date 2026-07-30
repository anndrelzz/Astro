import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { AdminMobileNav, AdminSidebar } from "./admin-sidebar";

// Casca do painel administrativo (mockup do admin em desktop): barra lateral
// fixa, tema escuro e area de conteudo. Envolve todas as telas de /admin.
//
// A checagem de sessao e role acontece aqui E em cada pagina. Nao e redundancia
// desnecessaria: o layout evita renderizar a casca para quem nao e admin, e a
// checagem por pagina e a que efetivamente protege os dados - o Next.js nao
// garante que o layout rode a cada navegacao entre telas irmas.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${slug}`);
  }

  // Contador do menu: agendamentos aguardando confirmacao manual do PIX (UC16).
  const pixPendentes = await withTenant(tenant.id, (tx) =>
    tx.agendamento.count({
      where: { tenantId: tenant.id, status: "PIX_PENDENTE" },
    })
  );

  const usuarioNome = session.user.name ?? "Admin";

  return (
    <div className="flex min-h-dvh bg-admin-bg text-slate-100">
      <AdminSidebar
        slug={slug}
        tenantNome={tenant.nome}
        usuarioNome={usuarioNome}
        pixPendentes={pixPendentes}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav
          slug={slug}
          tenantNome={tenant.nome}
          pixPendentes={pixPendentes}
        />
        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
