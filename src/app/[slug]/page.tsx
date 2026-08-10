import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LayoutDashboard, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { Logo } from "@/components/ui/astro";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeColor } from "@/components/ui/theme-color";
import { ClienteShell } from "./cliente-shell";
import { HomeServicos } from "./home-servicos";
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

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) notFound();

  const session = await getServerSession(authOptions);
  const logado = session?.user.tenantId === tenant.id;

  // A vitrine so existe para quem esta autenticado (RF03): o preco depende do
  // segmento do veiculo do cliente e agendar exige conta. Visitante vai direto
  // ao login, que e onde a estetica se apresenta (RF14). Sai a tela 01 do
  // mockup — ela era uma porta na frente de outra porta.
  if (!logado) {
    redirect(`/${slug}/login`);
  }

  const { servicosTenant, veiculos } = await withTenant(tenant.id, async (tx) => {
    // RN14 — a vitrine mostra apenas servicos ativos. Pausado sai daqui, mas
    // continua existindo para os agendamentos que ja o referenciam.
    const servicosTenant = await tx.servico.findMany({
      where: { tenantId: tenant.id, ativo: true },
      orderBy: { nome: "asc" },
    });
    const veiculos = await tx.veiculo.findMany({
      where: { usuarioId: session!.user.id },
    });
    return { servicosTenant, veiculos };
  });

  const servicos = servicosTenant.map((s) => ({
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    duracaoMin: s.duracaoMin,
    precos: {
      HATCH: Number(s.precoHatch),
      SEDAN: Number(s.precoSedan),
      SUV: Number(s.precoSuv),
      PICKUP: Number(s.precoPickup),
      VAN: Number(s.precoVan),
    } as Record<SegmentoVeiculo, number>,
  }));

  // Endereco montado a partir do que estiver preenchido — estetica que so
  // informou bairro e cidade mostra so isso, sem virgulas soltas.
  const endereco = [
    [tenant.rua, tenant.numero].filter(Boolean).join(", "),
    tenant.bairro,
    [tenant.cidade, tenant.estado].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(" · ");

  const segmentoInicial: SegmentoVeiculo = veiculos[0]?.segmento ?? "SUV";
  const primeiroNome = session?.user.name?.split(" ")[0] ?? "";
  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <ClienteShell
      slug={slug}
      // Sem trilha aqui: esta e a raiz do app do cliente, entao "Inicio /
      // Servicos" nao levaria a lugar nenhum acima. A saudacao ja diz onde ele
      // esta, e a barra lateral marca o item ativo.
      titulo={`Olá, ${primeiroNome}`}
      acoes={
        session?.user.role === "ADMIN" ? (
          <Link
            href={`/${slug}/admin/agendamentos`}
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-600 transition hover:border-zinc-300"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Painel
          </Link>
        ) : undefined
      }
    >
      <div className="min-h-dvh bg-[#f6f8fb] pb-28 lg:min-h-0 lg:pb-10">
        <ThemeColor color="#f6f8fb" />
        {/* Cabecalho do celular. No desktop quem apresenta a saudacao e o
            atalho do painel e o cabecalho da casca. */}
        <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-astro-bg text-sm font-semibold text-white">
              {primeiroNome[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="leading-tight">
              <p className="text-xs text-zinc-400">Olá,</p>
              <p className="font-semibold text-zinc-900">{primeiroNome}</p>
            </div>
          </div>

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

        <main className="mx-auto max-w-md px-5 lg:max-w-none lg:px-8">
          {/* Card da estetica — descricao, endereco e contatos vem das
              Configuracoes do Admin (UC13) */}
          <div className="astro-dark mt-5 rounded-2xl px-5 py-6 lg:mt-4 lg:px-7 lg:py-7">
            <div className="flex items-start justify-between gap-4">
              {/* Trava de largura no desktop: sem ela a descricao se estica
                  por toda a tela e vira uma linha unica dificil de ler. */}
              <div className="min-w-0 lg:max-w-2xl">
                <h1 className="text-xl font-bold text-white lg:text-2xl">{tenant.nome}</h1>
                {tenant.descricao && (
                  <p className="mt-1.5 text-sm leading-relaxed text-astro-muted">
                    {tenant.descricao}
                  </p>
                )}
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
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

            {endereco && (
              <p className="mt-4 flex items-start gap-2 text-sm text-astro-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {endereco}
              </p>
            )}

            {(tenant.whatsapp || tenant.telefone || tenant.emailContato) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {tenant.whatsapp && (
                  <a
                    href={`https://wa.me/55${tenant.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                {tenant.telefone && (
                  <a
                    href={`tel:+55${tenant.telefone}`}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Ligar
                  </a>
                )}
                {tenant.emailContato && (
                  <a
                    href={`mailto:${tenant.emailContato}`}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    E-mail
                  </a>
                )}
              </div>
            )}
          </div>

          <HomeServicos
            slug={slug}
            servicos={servicos}
            segmentoInicial={segmentoInicial}
            logado={logado}
            temVeiculo={veiculos.length > 0}
          />
        </main>

        <BottomNav slug={slug} />
      </div>
    </ClienteShell>
  );
}
