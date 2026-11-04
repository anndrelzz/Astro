import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/back/auth";
import { prisma } from "@/back/prisma";
import { withTenant } from "@/back/tenant-db";
import { ClientesAdmin, type ClienteDoPainel } from "@/front/admin/clientes-admin";

// Aba Clientes do painel (decisao do orientador, 30/10): quem ja se cadastrou
// na estetica, os carros e o historico de cada um. A busca, os filtros e o
// painel de detalhes rodam no cliente, sem ida ao servidor.
export default async function AdminClientesPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const usuarios = await withTenant(tenant.id, (tx) =>
    tx.usuario.findMany({
      where: { tenantId: tenant.id, role: "CLIENTE" },
      include: {
        veiculos: { where: { ativo: true }, include: { segmento: true } },
        agendamentos: { include: { servico: true, veiculo: true }, orderBy: { dataHora: "desc" } },
      },
      orderBy: { nome: "asc" },
    })
  );

  const clientes: ClienteDoPainel[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? "",
    desdeISO: u.criadoEm.toISOString(),
    veiculos: u.veiculos.map((v) => ({
      id: v.id,
      descricao: `${v.marca} ${v.modelo}`,
      placa: v.placa,
      segmento: v.segmento.nome,
    })),
    agendamentos: u.agendamentos.map((a) => ({
      id: a.id,
      dataISO: a.dataHora.toISOString(),
      fimISO: new Date(a.dataHora.getTime() + a.servico.duracaoMin * 60000).toISOString(),
      servico: a.servico.nome,
      placa: a.veiculo.placa,
      status: a.status,
      valor: Number(a.valor) + (a.acrescimoAplicado === null ? 0 : Number(a.acrescimoAplicado)),
      pago: a.pagoEm !== null,
    })),
  }));

  return <ClientesAdmin clientes={clientes} agoraISO={new Date().toISOString()} />;
}
