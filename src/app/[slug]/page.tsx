import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/ui/astro";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeColor } from "@/components/ui/theme-color";
import { HomeServicos } from "./home-servicos";
import { Hero } from "./hero";
import type { SegmentoVeiculo } from "@/generated/prisma/enums";

// RN09 — URL publica de cada estetica: astro.app/[slug-da-estetica].
// Home do cliente conforme mockup (tela 06): saudacao, card da estetica,
// selecao de segmento e cards de servico com preco por segmento (RF01, RF04).
export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { servicos: { orderBy: { nome: "asc" } } },
  });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  const logado = session?.user.tenantId === tenant.id;

  // Tela 01 (hero) para visitante deslogado; home (tela 06) para logado.
  if (!logado) {
    return <Hero slug={slug} nome={tenant.nome} />;
  }

  const veiculos = logado
    ? await prisma.veiculo.findMany({ where: { usuarioId: session!.user.id } })
    : [];

  const servicos = tenant.servicos.map((s) => ({
    id: s.id,
    nome: s.nome,
    duracaoMin: s.duracaoMin,
    precos: {
      HATCH: Number(s.precoHatch),
      SEDAN: Number(s.precoSedan),
      SUV: Number(s.precoSuv),
      PICKUP: Number(s.precoPickup),
      VAN: Number(s.precoVan),
    } as Record<SegmentoVeiculo, number>,
  }));

  const segmentoInicial: SegmentoVeiculo = veiculos[0]?.segmento ?? "SUV";
  const primeiroNome = session?.user.name?.split(" ")[0] ?? "";
  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh bg-[#f6f8fb] pb-28">
      <ThemeColor color="#f6f8fb" />
      {/* Cabecalho */}
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {logado ? (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-astro-bg text-sm font-semibold text-white">
              {primeiroNome[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="leading-tight">
              <p className="text-xs text-zinc-400">Olá,</p>
              <p className="font-semibold text-zinc-900">{primeiroNome}</p>
            </div>
          </div>
        ) : (
          <Link
            href={`/${slug}/login`}
            className="rounded-full bg-astro-blue px-4 py-2 text-sm font-semibold text-white"
          >
            Entrar
          </Link>
        )}

        <div className="flex items-center gap-3">
          {session?.user.role === "ADMIN" && (
            <Link
              href={`/${slug}/admin/agendamentos`}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Painel
            </Link>
          )}
          <Logo className="text-base text-zinc-900" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5">
        {/* Card da estetica */}
        <div className="astro-dark mt-5 flex items-center justify-between rounded-2xl px-5 py-6">
          <h1 className="text-xl font-bold text-white">{tenant.nome}</h1>
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={`Logo ${tenant.nome}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-sm font-semibold tracking-wide text-white">
                {iniciais}
              </span>
            )}
          </div>
        </div>

        <HomeServicos
          slug={slug}
          servicos={servicos}
          segmentoInicial={segmentoInicial}
          logado={logado}
          temVeiculo={veiculos.length > 0}
        />
      </main>

      {logado && <BottomNav slug={slug} />}
    </div>
  );
}
