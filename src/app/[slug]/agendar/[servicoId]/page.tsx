import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { calcularPreco } from "@/lib/precificacao";
import { prisma } from "@/lib/prisma";

// UC03, RN04 — ao clicar em Agendar, o sistema verifica se ha veiculo
// cadastrado; se nao houver, redireciona para o cadastro e retorna aqui
// depois (callbackUrl). Se houver, mostra o preco calculado por segmento.
export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string; servicoId: string }>;
}) {
  const { slug, servicoId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const servico = await prisma.servico.findFirst({
    where: { id: servicoId, tenantId: tenant.id },
  });
  if (!servico) notFound();

  const session = await getServerSession(authOptions);
  if (!session || session.user.tenantId !== tenant.id) {
    // Proxy ja deveria ter barrado isso (RN02); guarda extra por seguranca.
    redirect(`/${slug}/login`);
  }

  const veiculos = await prisma.veiculo.findMany({
    where: { usuarioId: session.user.id },
  });

  const callbackUrl = `/${slug}/agendar/${servicoId}`;

  if (veiculos.length === 0) {
    redirect(`/${slug}/veiculos/novo?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Agendar: {servico.nome}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Selecione o veiculo para calcular o preco (RF04)
      </p>

      <ul className="mt-6 space-y-3">
        {veiculos.map((veiculo) => {
          const preco = calcularPreco(servico, veiculo.segmento);
          return (
            <li key={veiculo.id}>
              <Link
                href={`/${slug}/agendar/${servicoId}/${veiculo.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span>
                  {veiculo.marca} {veiculo.modelo} ({veiculo.placa}) —{" "}
                  {veiculo.segmento}
                </span>
                <span className="font-semibold">
                  R$ {preco.toFixed(2).replace(".", ",")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/${slug}`}
        className="mt-4 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Voltar
      </Link>
    </div>
  );
}
