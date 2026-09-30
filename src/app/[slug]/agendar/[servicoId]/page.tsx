import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { ClienteShell } from "../../cliente-shell";
import { AgendarForm } from "./agendar-form";

// UC03, tela 09 — escolha de data/horario/veiculo. RN04: sem veiculo
// cadastrado, redireciona para o cadastro e retorna aqui depois.
export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string; servicoId: string }>;
}) {
  const { slug, servicoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    redirect(`/${slug}/login?callbackUrl=/${slug}/agendar/${servicoId}`);
  }

  const { servico, veiculos } = await withTenant(tenant.id, async (tx) => {
    // RN14 — servico pausado nao aparece nem pode ser agendado
    const servico = await tx.servico.findFirst({
      where: { id: servicoId, tenantId: tenant.id, ativo: true },
      include: { precos: true },
    });
    // RN15 — so os veiculos ativos entram na escolha.
    const veiculos = await tx.veiculo.findMany({
      where: { usuarioId: session.user.id, ativo: true },
      include: { segmento: true },
    });
    return { servico, veiculos };
  });
  if (!servico) notFound();

  // RN04 — precisa de ao menos um veiculo para agendar.
  if (veiculos.length === 0) {
    redirect(
      `/${slug}/veiculos/novo?callbackUrl=${encodeURIComponent(
        `/${slug}/agendar/${servicoId}`
      )}`
    );
  }

  // RN01 — carro cujo tipo ainda nao tem preco neste servico fica de fora da
  // escolha. Oferecer e deixar o POST recusar depois seria pior: o cliente
  // escolheria o carro e levaria o erro so no fim.
  const veiculosView = veiculos.flatMap((v) => {
    const preco = calcularPreco(servico.precos, v.segmentoId);
    if (preco === null) return [];
    return [
      {
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        placa: v.placa,
        ano: v.ano,
        segmento: v.segmento.nome,
        preco: Number(preco),
      },
    ];
  });

  if (veiculosView.length === 0) {
    redirect(`/${slug}`);
  }

  return (
    <ClienteShell
      slug={slug}
      trilha={["Serviços", servico.nome, "Agendar"]}
      titulo="Agendar serviço"
    >
      <AgendarForm
        slug={slug}
        tenantId={tenant.id}
        servico={{
          id: servico.id,
          nome: servico.nome,
          duracaoMin: servico.duracaoMin,
        }}
        veiculos={veiculosView}
      />
    </ClienteShell>
  );
}
