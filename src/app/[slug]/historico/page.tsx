import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ClienteShell } from "../cliente-shell";
import { HistoricoLista } from "./historico-lista";

// RF15, UC05 — historico de agendamentos do cliente (tela 13 do mockup).
// O cancelamento (tela 14) e feito por um modal dentro de HistoricoLista.
export default async function HistoricoPage({
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

  const agendamentos = await withTenant(tenant.id, (tx) =>
    tx.agendamento.findMany({
      where: { tenantId: tenant.id, usuarioId: session.user.id },
      include: { servico: true, veiculo: { include: { segmento: true } } },
      orderBy: { dataHora: "desc" },
    })
  );

  // O "pode cancelar" era decidido aqui, com o relogio do servidor, e virava
  // prop congelada no momento da renderizacao. A HistoricoLista, do lado do
  // cliente, recalculava a categoria do agendamento com o relogio do navegador
  // a cada render. Dois relogios decidindo coisas diferentes sobre a mesma
  // linha: uma aba deixada aberta cruzando a janela de cancelamento passava a
  // mostrar o selo "Concluido" com o botao "Cancelar" ainda ativo.
  //
  // Agora o servidor manda so o dado bruto e quem decide as duas coisas e a
  // tela, com um relogio so. Isso tambem tira o Date.now() da renderizacao do
  // Server Component (react-hooks/purity): render passa a depender apenas do
  // que veio do banco.
  //
  // A rota de cancelamento revalida a janela antes de gravar (RN11), entao a
  // tela nunca e a unica guarda.
  const itens = agendamentos.map((a) => ({
    id: a.id,
    dataHoraISO: a.dataHora.toISOString(),
    duracaoMin: a.servico.duracaoMin,
    servicoNome: a.servico.nome,
    veiculoMarcaModelo: `${a.veiculo.marca} ${a.veiculo.modelo}`,
    segmento: a.veiculo.segmento.nome,
    valor: Number(a.valor),
    acrescimoAplicado: a.acrescimoAplicado === null ? null : Number(a.acrescimoAplicado),
    status: a.status,
    formaPagamento: a.formaPagamento,
  }));

  return (
    <ClienteShell
      slug={slug}
      trilha={["Conta", "Agendamentos"]}
      titulo="Meus agendamentos"
    >
      <HistoricoLista
        slug={slug}
        itens={itens}
        horasLimite={tenant.cancelamentoHorasLimite}
      />
    </ClienteShell>
  );
}
