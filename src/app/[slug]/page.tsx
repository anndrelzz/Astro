import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { Logo } from "@/components/ui/astro";
import { ThemeColor } from "@/components/ui/theme-color";
import { ClienteShell } from "./cliente-shell";
import { HomeServicos } from "./home-servicos";
import { ProximoHorario, type Marcado } from "./proximo-horario";

// RN09 — URL publica de cada estetica: astro.app/[slug-da-estetica].
// Home do cliente (tela 06): saudacao, cartao da estetica com o WhatsApp, o
// proximo horario (ou o ultimo servico) e a lista de servicos
// com o preco do carro do cliente (RF01, RF04). Fundo claro de pontos, pensada
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

  const { servicosTenant, veiculos, marcados, anterior } = await withTenant(tenant.id, async (tx) => {
    // RN14 — a vitrine mostra apenas servicos ativos. Pausado sai daqui, mas
    // continua existindo para os agendamentos que ja o referenciam.
    const servicosTenant = await tx.servico.findMany({
      where: { tenantId: tenant.id, ativo: true },
      // So os precos dos tipos que a estetica ainda atende: um tipo removido
      // nao pode alargar a faixa de precos de quem nao tem carro cadastrado.
      include: { precos: { where: { segmento: { ativo: true } } } },
      orderBy: { nome: "asc" },
    });
    // RN15 — aposentado nao conta para o "tem veiculo?" da RN04. Quem so tem
    // carros aposentados cai no mesmo alerta de quem nao tem nenhum.
    const veiculos = await tx.veiculo.findMany({
      where: { usuarioId: session!.user.id, ativo: true },
      include: { segmento: true },
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
    // Sem nada marcado, o cartao mostra o ultimo servico feito. Cancelado nao
    // conta; um horario que ja passou conta como feito, mesmo sem o status
    // CONCLUIDO, que nenhuma rota grava sozinha.
    const anterior = await tx.agendamento.findFirst({
      where: {
        tenantId: tenant.id,
        usuarioId: session!.user.id,
        status: { not: "CANCELADO" },
        dataHora: { lt: agora },
      },
      include: { servico: true, veiculo: true },
      orderBy: { dataHora: "desc" },
    });
    return { servicosTenant, veiculos, marcados, anterior };
  });

  type ComServico = (typeof marcados)[number];
  const paraCartao = (a: ComServico, status: Marcado["status"]): Marcado => ({
    id: a.id,
    dataHora: a.dataHora,
    duracaoMin: a.servico.duracaoMin,
    servicoId: a.servicoId,
    servicoNome: a.servico.nome,
    servicoAtivo: a.servico.ativo,
    veiculo: `${a.veiculo.marca} ${a.veiculo.modelo}`,
    placa: a.veiculo.placa,
    status,
  });

  const emAberto = marcados.find(
    (a) => a.dataHora.getTime() + a.servico.duracaoMin * 60000 > agora.getTime()
  );
  const destaque = emAberto
    ? { modo: "proximo" as const, marcado: paraCartao(emAberto, emAberto.status as Marcado["status"]) }
    : anterior
      ? { modo: "ultimo" as const, marcado: paraCartao(anterior, "CONCLUIDO") }
      : null;

  const servicos = servicosTenant.map((s) => ({
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    duracaoMin: s.duracaoMin,
    // Mapa segmentoId -> preco. Tipo sem preco fica de fora do mapa, e o card
    // mostra "Sob consulta" em vez de um valor inventado.
    precos: Object.fromEntries(
      s.precos.map((p) => [p.segmentoId, Number(p.valor)])
    ) as Record<string, number>,
  }));

  // O preco mostrado e o do carro do cliente (o primeiro da garagem, o mesmo
  // que aparece como principal no perfil). Carro de um tipo que a estetica
  // removeu nao conta; sem carro valido, os cards mostram a faixa de precos.
  const carroPrincipal = veiculos.find((v) => v.segmento.ativo);
  const carro = carroPrincipal
    ? {
        segmentoId: carroPrincipal.segmentoId,
        segmentoNome: carroPrincipal.segmento.nome,
        nome: `${carroPrincipal.marca} ${carroPrincipal.modelo}`,
      }
    : null;
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
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300"
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        Painel
      </Link>
    ) : undefined;

  return (
    <ClienteShell slug={slug} pontos titulo={`Olá, ${primeiroNome}`} acoes={painel}>
      <ThemeColor color="#f6f8fb" />
      <div className="pb-[calc(env(safe-area-inset-bottom)+7.5rem)] lg:pb-10">
        {/* Cabecalho do celular. No desktop quem apresenta a saudacao e o
            atalho do painel e o cabecalho da casca. */}
        <header className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
              {primeiroNome[0]?.toUpperCase() ?? "U"}
            </span>
            <p className="truncate text-xl font-bold text-zinc-900">Olá, {primeiroNome}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {painel}
            <Logo variant="preto" className="h-6" />
          </div>
        </header>

        <main className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-5 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5 lg:px-8 lg:pt-5">
          {/* Cartao da estetica — logo e nome vem das Configuracoes do Admin
              (UC13). Um contato so, o WhatsApp da loja, num botao redondo a
              direita: e por onde o cliente fala com a loja quando nao
              consegue agendar. Compacto para o proximo horario subir. */}
          <section
            aria-label={tenant.nome}
            className={`flex items-center gap-3.5 rounded-3xl border border-zinc-200/80 bg-white/85 p-4 shadow-[0_10px_30px_-18px_rgb(15_23_42/0.25)] backdrop-blur lg:p-5 ${destaque ? "" : "lg:col-span-2"}`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-astro-bg">
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
            <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug text-zinc-900">{tenant.nome}</h2>

            {linkWhatsapp && (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar no WhatsApp"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_20px_-10px_#25D366] transition hover:brightness-105"
              >
                <IconeWhatsapp className="h-6 w-6" />
              </a>
            )}
          </section>

          {destaque && (
            <ProximoHorario slug={slug} marcado={destaque.marcado} modo={destaque.modo} agora={agora} />
          )}

          <div className="lg:col-span-2">
            <HomeServicos
              slug={slug}
              servicos={servicos}
              carro={carro}
              logado={logado}
              temVeiculo={veiculos.length > 0}
            />
          </div>
        </main>
      </div>
    </ClienteShell>
  );
}

// Icone do WhatsApp (o lucide nao tem marcas). Desenho de um caminho so, em
// branco sobre o verde do botao.
function IconeWhatsapp({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.21-3.6.94.96-3.5-.23-.36a9.46 9.46 0 0 1-1.45-5.05c0-5.23 4.26-9.49 9.5-9.49 2.54 0 4.92.99 6.71 2.79a9.43 9.43 0 0 1 2.78 6.71c0 5.24-4.26 9.5-9.47 9.5zm8.08-17.58A11.35 11.35 0 0 0 12.05.58C5.75.58.62 5.7.62 12c0 2.01.53 3.98 1.53 5.71L.52 23.42l5.84-1.53a11.4 11.4 0 0 0 5.69 1.45h.01c6.3 0 11.43-5.13 11.43-11.43 0-3.05-1.19-5.92-3.36-8.08z" />
    </svg>
  );
}
