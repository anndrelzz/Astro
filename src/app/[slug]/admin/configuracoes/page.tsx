import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConfiguracoesAdmin } from "./configuracoes-admin";
import { AdminHeader } from "../admin-header";

// UC13, UC14, RF13, RF17, RF18, RN06 — configuracoes gerais da estetica.
// A grade de horarios (UC09/RF02) saiu daqui para tela propria.
export default async function AdminConfiguracoesPage({
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
      <AdminHeader trilha="Configuracoes · Loja" titulo="Configuracoes da estetica" />
      <ConfiguracoesAdmin
        configInicial={{
          pixChaveCopiaCola: tenant.pixChaveCopiaCola ?? "",
          cancelamentoHorasLimite: tenant.cancelamentoHorasLimite,
          capacidadeSimultanea: tenant.capacidadeSimultanea,
          intervaloMinutos: tenant.intervaloMinutos,
          corPrimaria: tenant.corPrimaria ?? "#0f172a",
        }}
        logoUrlInicial={tenant.logoUrl}
      />
    </>
  );
}
