import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminHeader } from "../admin-header";
import { IdentidadeAdmin } from "./identidade-admin";

// UC12, RF13 — tela propria para a identidade visual, como no mockup do admin.
// Antes esta secao vivia dentro de /configuracoes.
export default async function AdminIdentidadePage({
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

  return (
    <>
      <AdminHeader
        trilha="Identidade visual · Marca da estetica"
        titulo="Identidade visual"
      />
      <IdentidadeAdmin
        logoUrlInicial={tenant.logoUrl}
        corInicial={tenant.corPrimaria ?? "#2563eb"}
        tenantNome={tenant.nome}
      />
    </>
  );
}
