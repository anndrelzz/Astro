import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LayoutDashboard, MapPin, MessageCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { Logo } from "@/components/ui/astro";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeColor } from "@/components/ui/theme-color";
import { ClienteShell } from "./cliente-shell";
import { HomeServicos } from "./home-servicos";
import { ProximoHorario, type Proximo } from "./proximo-horario";

// RN09 — URL publica de cada estetica: astro.app/[slug-da-estetica].
// Home do cliente (tela 06): saudacao, cartao da estetica com o WhatsApp,
// o proximo horario marcado (quando houver), selecao de segmento e a lista de
// servicos com preco por segmento (RF01, RF04). Tema escuro do painel, pensada
// primeiro para o celular.
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

  const agora = new Date();

  const { servicosTenant, veiculos, segmentos, marcados } = await withTenant(tenant.id, async (tx) => {
    // RN14 — a vitrine mostra apenas servicos ativos. Pausado sai daqui, mas
    // continua existindo para os agendamentos que ja o referenciam.
    const servicosTenant = await tx.servico.findMany({
      where: { tenantId: tenant.id, ativo: true },
      include: { precos: true },
      orderBy: { nome: "asc" },
    });
    // RN15 — aposentado nao conta para o "tem veiculo?" da RN04. Quem so tem
    // carros aposentados cai no mesmo alerta de quem nao tem nenhum.
    const veiculos = await tx.veiculo.findMany({
      where: { usuarioId: session!.user.id, ativo: true },
      include: { segmento: true },
    });
    // Os tipos que ESTA estetica atende, na ordem que ela definiu (RN01
    // revisada). Aposentado fica de fora do seletor.
    const segmentos = await tx.segmento.findMany({
      where: { tenantId: tenant.id, ativo: true },
      orderBy: { ordem: "asc" },
    });
    // Candidatos a "proximo horario": os ativos a partir de ontem, para pegar
    // tambem um servico de varias horas que comecou e ainda nao terminou.
    // Quem decide se ja acabou e o fim (inicio + duracao), logo abaixo.
    const marcados = await tx.agendamento.findMany({
      where: {
        tenantId: tenant.id,
        usuarioId: session!.user.id,
        status: { in: ["CONFIRMADO", "PIX_PENDENTE", "PENDENTE_PAGAMENTO"] },
        dataHora: { gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000) },
      },
      include: { servico: true, veiculo: true },
      orderBy: { dataHora: "asc" },
      take: 5,
    });
    return { servicosTenant, veiculos, segmentos, marcados };
  });

  const marcado = marcados.find(
    (a) => a.dataHora.getTime() + a.servico.duracaoMin * 60000 > agora.getTime()
  );
  const proximo: Proximo | null = marcado
    ? {
        id: marcado.id,
        dataHora: marcado.dataHora,
        duracaoMin: marcado.servico.duracaoMin,
        servicoNome: marcado.servico.nome,
        veiculo: `${marcado.veiculo.marca} ${marcado.veiculo.modelo}`,
        placa: marcado.veiculo.placa,
        status: marcado.status as Proximo["status"],
      }
    : null;

  const servicos = servicosTenant.map((s) => ({
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    duracaoMin: s.duracaoMin,
    // Mapa segmentoId -> preco. Servico sem preco para um segmento simplesmente
    // nao aparece naquele filtro, em vez de aparecer com valor inventado.
    precos: Object.fromEntries(
      s.precos.map((p) => [p.segmentoId, Number(p.valor)])
    ) as Record<string, number>,
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

  // Abre no tipo do carro que o cliente ja tem; sem carro, no primeiro da
  // estetica. Antes o padrao era "SUV" fixo, que agora pode nem existir.
  // Carro de um tipo removido nao conta: abriria num tipo que nem esta na lista.
  const segmentoInicial =
    veiculos.find((v) => v.segmento.ativo)?.segmentoId ?? segmentos[0]?.id ?? "";
  const primeiroNome = session?.user.name?.split(" ")[0] ?? "";
  const iniciais = tenant.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // Mensagem ja escrita no WhatsApp: quem chega por aqui geralmente nao
  // conseguiu agendar pelo app e quer falar com a loja.
  const linkWhatsapp = tenant.whatsapp
    ? `https://wa.me/55${tenant.whatsapp}?text=${encodeURIComponent(
        `Olá! Vim pelo app de agendamento da ${tenant.nome}.`
      )}`
    : null;

  const painel =
    session?.user.role === "ADMIN" ? (
      <Link
        href={`/${slug}/admin/agendamentos`}
        className="flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        Painel
      </Link>
    ) : undefined;

  return (
    <ClienteShell slug={slug} escuro titulo={`Olá, ${primeiroNome}`} acoes={painel}>
      <ThemeColor color="#000000" />
      <div className="pb-[calc(env(safe-area-inset-bottom)+7rem)] lg:pb-10">
        {/* Cabecalho do celular. No desktop quem apresenta a saudacao e o
            atalho do painel e o cabecalho da casca. */}
        <header className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
              {primeiroNome[0]?.toUpperCase() ?? "U"}
            </span>
            <p className="truncate text-xl font-bold text-white">Olá, {primeiroNome}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {painel}
            <Logo className="h-4" />
          </div>
        </header>

        <main className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-5 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5 lg:px-8 lg:pt-5">
          {/* Cartao da estetica — nome, logo, descricao e endereco vem das
              Configuracoes do Admin (UC13). Um contato so, o WhatsApp: e por
              onde o cliente fala com a loja quando nao consegue agendar. */}
          <section
            aria-label={tenant.nome}
            className={`vidro flex flex-col rounded-3xl p-5 lg:p-6 ${proximo ? "" : "lg:col-span-2"}`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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
              <h2 className="min-w-0 text-lg font-bold leading-snug text-white">{tenant.nome}</h2>
            </div>

            {tenant.descricao && (
              <p className="mt-3 text-sm leading-relaxed text-astro-muted">{tenant.descricao}</p>
            )}
            {endereco && (
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-astro-muted" />
                {endereco}
              </p>
            )}

            {linkWhatsapp && (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 lg:mt-auto lg:self-start lg:px-5"
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            )}
          </section>

          {proximo && <ProximoHorario slug={slug} proximo={proximo} agora={agora} />}

          <div className="lg:col-span-2">
            <HomeServicos
              slug={slug}
              servicos={servicos}
              segmentos={segmentos.map((s) => ({ id: s.id, nome: s.nome }))}
              segmentoInicial={segmentoInicial}
              logado={logado}
              temVeiculo={veiculos.length > 0}
            />
          </div>
        </main>

        <BottomNav slug={slug} escuro />
      </div>
    </ClienteShell>
  );
}
