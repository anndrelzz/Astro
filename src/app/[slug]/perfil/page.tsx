import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PerfilCliente } from "./perfil-cliente";

// UC15, tela 04 do mockup — perfil do cliente: dados de contato, estatisticas
// e lista de veiculos. A edicao (tela 05) e um modal em PerfilCliente.
export default async function PerfilPage({
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

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      veiculos: { orderBy: { id: "asc" } },
      _count: { select: { agendamentos: true } },
    },
  });
  if (!usuario) redirect(`/${slug}/login`);

  const desde = usuario.criadoEm
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .toUpperCase();

  return (
    <PerfilCliente
      slug={slug}
      nome={usuario.nome}
      email={usuario.email}
      telefone={usuario.telefone ?? ""}
      desde={desde}
      totalAgendamentos={usuario._count.agendamentos}
      veiculos={usuario.veiculos.map((v) => ({
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        placa: v.placa,
        ano: v.ano,
        cor: v.cor,
        segmento: v.segmento,
      }))}
    />
  );
}
