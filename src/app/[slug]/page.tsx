import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// RN09 — URL publica de cada estetica: astro.app/[slug-da-estetica].
// Pagina inicial do tenant: lista de servicos com preco por segmento (RF01, RF04).
export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { servicos: true },
  });

  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  // Isolamento por tenant a nivel de aplicacao (RLS ainda nao habilitado, ver M1).
  const logadoNesteTenant = session?.user.tenantId === tenant.id;

  const veiculos = logadoNesteTenant
    ? await prisma.veiculo.findMany({ where: { usuarioId: session!.user.id } })
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {tenant.nome}
        </h1>
        {logadoNesteTenant ? (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Logado como {session?.user.name} ({session?.user.role})
          </span>
        ) : (
          <Link
            href={`/${slug}/login`}
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Entrar
          </Link>
        )}
      </div>

      <ul className="mt-6 space-y-3">
        {tenant.servicos.map((servico) => (
          <li
            key={servico.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span>
              {servico.nome} — {servico.duracaoMin} min
            </span>
            {logadoNesteTenant && (
              <Link
                href={`/${slug}/agendar/${servico.id}`}
                className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-50 dark:text-black"
              >
                Agendar
              </Link>
            )}
          </li>
        ))}
        {tenant.servicos.length === 0 && (
          <li className="text-zinc-500">Nenhum servico cadastrado ainda.</li>
        )}
      </ul>

      {logadoNesteTenant && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Meus veiculos
            </h2>
            <Link
              href={`/${slug}/veiculos/novo`}
              className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
            >
              Cadastrar veiculo
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {veiculos.map((veiculo) => (
              <li
                key={veiculo.id}
                className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                {veiculo.marca} {veiculo.modelo} ({veiculo.placa}) — {veiculo.segmento}
              </li>
            ))}
            {veiculos.length === 0 && (
              <li className="text-sm text-zinc-500">
                Nenhum veiculo cadastrado ainda (RN04).
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
