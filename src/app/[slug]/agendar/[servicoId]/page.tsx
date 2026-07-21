import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";
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

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId: tenant.id },
  });
  if (!servico) notFound();

  const veiculos = await prisma.veiculo.findMany({
    where: { usuarioId: session.user.id },
  });

  // RN04 — precisa de ao menos um veiculo para agendar.
  if (veiculos.length === 0) {
    redirect(
      `/${slug}/veiculos/novo?callbackUrl=${encodeURIComponent(
        `/${slug}/agendar/${servicoId}`
      )}`
    );
  }

  const veiculosView = veiculos.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    placa: v.placa,
    ano: v.ano,
    segmento: v.segmento,
    preco: Number(calcularPreco(servico, v.segmento)),
  }));

  return (
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
  );
}
