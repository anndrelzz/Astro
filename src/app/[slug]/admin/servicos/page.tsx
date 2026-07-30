import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ServicosAdmin } from "./servicos-admin";
import { AdminHeader } from "../admin-header";

// UC08, RF01 — Admin gerencia servicos e precos por segmento de veiculo.
export default async function AdminServicosPage({
  params,
}: {
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

  const servicos = await withTenant(tenant.id, (tx) =>
    tx.servico.findMany({
      where: { tenantId: tenant.id },
      orderBy: { nome: "asc" },
    })
  );

  return (
    <>
      <AdminHeader
        trilha={`Catalogo · ${servicos.length} servico${servicos.length === 1 ? "" : "s"}`}
        titulo="Servicos"
      />
      <ServicosAdmin
        servicosIniciais={servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          duracaoMin: s.duracaoMin,
          precoHatch: Number(s.precoHatch),
          precoSedan: Number(s.precoSedan),
          precoSuv: Number(s.precoSuv),
          precoPickup: Number(s.precoPickup),
          precoVan: Number(s.precoVan),
        }))}
      />
    </>
  );
}
