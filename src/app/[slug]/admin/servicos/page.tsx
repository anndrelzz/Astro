import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServicosAdmin } from "./servicos-admin";
import { AdminNav } from "../admin-nav";

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

  const servicos = await prisma.servico.findMany({
    where: { tenantId: tenant.id },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <AdminNav slug={slug} />
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Servicos
      </h1>
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
    </div>
  );
}
