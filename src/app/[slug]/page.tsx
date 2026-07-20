import { notFound } from "next/navigation";
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

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {tenant.nome}
      </h1>
      <ul className="mt-6 space-y-3">
        {tenant.servicos.map((servico) => (
          <li
            key={servico.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            {servico.nome} — {servico.duracaoMin} min
          </li>
        ))}
        {tenant.servicos.length === 0 && (
          <li className="text-zinc-500">Nenhum servico cadastrado ainda.</li>
        )}
      </ul>
    </div>
  );
}
