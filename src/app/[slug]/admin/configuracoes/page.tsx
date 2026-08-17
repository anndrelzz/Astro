import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConfiguracoesAdmin } from "./configuracoes-admin";

// UC13, UC14, RF13, RF17, RF18, RN06 — configuracoes gerais da estetica.
// A grade de horarios (UC09/RF02) tem tela propria.
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
    <ConfiguracoesAdmin
      slug={tenant.slug}
      configInicial={{
        nome: tenant.nome,
        descricao: tenant.descricao ?? "",
        telefone: tenant.telefone ?? "",
        whatsapp: tenant.whatsapp ?? "",
        emailContato: tenant.emailContato ?? "",
        cep: tenant.cep ?? "",
        rua: tenant.rua ?? "",
        numero: tenant.numero ?? "",
        bairro: tenant.bairro ?? "",
        cidade: tenant.cidade ?? "",
        estado: tenant.estado ?? "",
        pixChaveCopiaCola: tenant.pixChaveCopiaCola ?? "",
        cancelamentoHorasLimite: tenant.cancelamentoHorasLimite,
        capacidadeSimultanea: tenant.capacidadeSimultanea,
        intervaloMinutos: tenant.intervaloMinutos,
      }}
    />
  );
}
