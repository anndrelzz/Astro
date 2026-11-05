import {
  ArrowUp,
  Bell,
  CalendarDays,
  Car,
  ChartColumn,
  Check,
  Clock,
  Diamond,
  Monitor,
  Palette,
  Plus,
  ShieldCheck,
  Smartphone,
  Tag,
  TriangleAlert,
  X,
} from "lucide-react";
import { Manrope } from "next/font/google";
import Image from "next/image";
import type { ReactNode } from "react";
import { FundoOndas } from "@/front/componentes/fundo-ondas";
import { ThemeColor } from "@/front/componentes/theme-color";
import { Heroi } from "./heroi";
import { Plano } from "./plano";
import { Vitrine } from "./vitrine";
import { PorDentro } from "./por-dentro";
import { ConfigAnimacao, Revelar } from "./revelar";

// Landing de vendas do Astro. Estrutura de secoes inspirada na pagina da
// Orbita (concorrente), com o visual proprio do Astro: imagem do ceu no
// topo e preto e branco com detalhes em azul, como as telas do app.
//
// Este arquivo e componente de servidor e guarda as secoes sem interacao.
// O que se mexe ou responde a clique fica em arquivos "use client":
// heroi.tsx (topo), vitrine.tsx (fluxo do cliente), por-dentro.tsx (abas), plano.tsx (preco) e
// revelar.tsx (secoes surgindo ao rolar).
//
// So promete o que o Astro faz. Os numeros da secao de comparacao vem da
// pesquisa com 5 esteticas do RFC (secao 1.2).

// Manrope so na landing: e a voz de "pagina de vendas". O app continua em
// Geist (layout.tsx).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export function Landing() {
  return (
    <ConfigAnimacao>
      <ThemeColor color="#09090b" />
      {/* isolate: o FundoOndas (fixo, -z-10) fica acima do preto desta casca e
          abaixo das secoes. A abertura cobre os pontos com a foto do ceu. */}
      <div
        className={`landing ${manrope.className} isolate min-h-dvh overflow-x-hidden bg-landing-night text-landing-ink`}
      >
        <FundoOndas rapido />
        <Heroi />
        <ComoFunciona />
        <Comparativo />
        {/* Sem titulo visivel: o espaco vai todo para a janela do painel. O
            titulo fica so para leitor de tela (e o menu "Por dentro" leva aqui). */}
        <section
          id="por-dentro"
          aria-labelledby="t-por-dentro"
          className="landing-tela border-y border-landing-line bg-white/[0.02] pt-22 pb-8"
        >
          <h2 id="t-por-dentro" className="sr-only">
            Conheça o Astro por dentro
          </h2>
          <div className="landing-wrap">
            <Revelar>
              <PorDentro />
            </Revelar>
          </div>
        </section>
        <PrecoPorCarro />
        <Recursos />
        <Aparelhos />
        <Preco />
        <Duvidas />
        <FaixaFinal />
        <Rodape />
      </div>
    </ConfigAnimacao>
  );
}

// ---------- pecas comuns ----------

function Secao({
  id,
  titulo,
  subtitulo,
  alternada = false,
  children,
}: {
  id?: string;
  titulo: string;
  subtitulo?: string;
  alternada?: boolean;
  children: ReactNode;
}) {
  const idTitulo = `t-${id ?? titulo.slice(0, 12).replace(/\W/g, "")}`;
  // Cada secao cabe numa tela (landing-tela, em globals.css): o pt-22 deixa
  // o conteudo abaixo do menu fixo quando a secao encosta no topo.
  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className={`landing-tela pt-22 pb-10 md:pb-12 ${alternada ? "border-y border-landing-line bg-white/[0.02]" : ""}`}
    >
      <div className="landing-wrap">
        {/* Placa de vidro (.vidro, a mesma dos cartoes do Admin) atras do titulo:
            as ondas claras do fundo passam por baixo e o texto continua legivel. */}
        <Revelar className="vidro mx-auto mb-5 grid w-fit max-w-4xl justify-items-center gap-2 rounded-3xl px-6 py-4 text-center sm:px-8">
          <h2
            id={idTitulo}
            className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight font-bold tracking-tight text-balance"
          >
            {titulo}
          </h2>
          {subtitulo && <p className="text-lg text-zinc-300">{subtitulo}</p>}
        </Revelar>
        {children}
      </div>
    </section>
  );
}

// ---------- secoes ----------

const SEM_ASTRO = [
  "Cliente espera você responder para saber se tem horário",
  "Dois clientes marcados no mesmo horário por engano",
  "Preço passado de cabeça, diferente a cada conversa",
  "Comprovante de PIX perdido no meio das mensagens",
  "Faturamento do mês só no caderno, quando existe",
];

const COM_ASTRO = [
  "O cliente vê os horários livres e marca na hora",
  "O Astro respeita a sua capacidade e não oferece horário lotado",
  "Preço fixo por serviço e por porte do carro, definido por você",
  "PIX copia e cola com a sua chave, confirmado no painel",
  "Receita por período e por serviço sem planilha",
];

function Comparativo() {
  return (
    <Secao
      id="comparativo"
      titulo="Por que sair do agendamento pelo WhatsApp?"
      subtitulo="Cinco estéticas foram ouvidas antes de o Astro existir. As cinco agendavam pelo WhatsApp, e quatro tinham perdido cliente por conflito de horário no último mês."
    >
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <Revelar className="grid content-start gap-3 rounded-3xl border border-landing-line bg-landing-surface p-5 sm:p-6">
          <h3 className="text-base font-extrabold tracking-widest text-landing-muted uppercase">
            Agenda pelo WhatsApp
          </h3>
          <ul className="grid gap-2.5">
            {SEM_ASTRO.map((t) => (
              <li key={t} className="flex items-start gap-3 text-landing-muted">
                <X
                  className="mt-0.5 size-6 shrink-0 rounded-full bg-red-400/12 p-1 text-red-400"
                  strokeWidth={3}
                />
                {t}
              </li>
            ))}
          </ul>
        </Revelar>
        <Revelar
          atraso={0.12}
          className="grid content-start gap-3 rounded-3xl border border-landing-glow/45 bg-[linear-gradient(180deg,rgba(37,99,235,0.24),rgba(37,99,235,0.08))] p-5 sm:p-6"
        >
          <h3 className="text-base font-extrabold tracking-widest text-landing-glow uppercase">
            Com o Astro
          </h3>
          <ul className="grid gap-2.5">
            {COM_ASTRO.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-6 shrink-0 rounded-full bg-emerald-400/14 p-1 text-emerald-400"
                  strokeWidth={3}
                />
                {t}
              </li>
            ))}
          </ul>
        </Revelar>
      </div>
    </Secao>
  );
}

function PrecoPorCarro() {
  return (
    <section
      aria-labelledby="t-preco-carro"
      className="landing-tela flex items-center pt-24 pb-12 lg:min-h-svh"
    >
      {/* O foco da secao sao os prints: a coluna deles e mais larga, e o
          texto fica menor, num vidro abaixo do titulo. */}
      <div className="landing-wrap grid items-center gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <Revelar className="grid gap-5">
          <h2
            id="t-preco-carro"
            className="text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-tight"
          >
            Preço certo para cada carro.
          </h2>
          <div className="vidro grid gap-4 rounded-3xl p-5">
            <p className="text-zinc-300">
              Lavar um SUV não custa o mesmo que lavar um hatch. No Astro, cada
              serviço tem um preço por porte, e o cliente vê o valor do carro
              dele antes de marcar.
            </p>
            <p className="text-zinc-300">
              Se o carro chegar em condição pior que o normal, você lança um
              acréscimo de até 30% ao confirmar. O cliente é avisado antes de
              agendar.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { icone: Tag, texto: "Preço por porte" },
                { icone: Car, texto: "Tipos de veículo seus" },
                { icone: TriangleAlert, texto: "Acréscimo avisado" },
              ].map(({ icone: Icone, texto }) => (
                <span
                  key={texto}
                  className="inline-flex items-center gap-1.5 rounded-full border border-landing-line-strong px-3 py-1.5 text-xs font-semibold"
                >
                  <Icone className="size-4 text-landing-glow" />
                  {texto}
                </span>
              ))}
            </div>
          </div>
        </Revelar>

        {/* Prints reais: os tipos de veiculo e os precos por tipo no Catalogo
            (Admin) e, por cima, o aviso de acrescimo que o cliente ve antes
            de pagar. */}
        <Revelar atraso={0.12} className="relative pb-24 sm:pr-36 sm:pb-10">
          <div className="overflow-hidden rounded-2xl border border-landing-line-strong bg-[#0c0c0e] shadow-[0_30px_70px_-40px_rgba(37,99,235,0.7)]">
            <div className="flex items-center gap-3 border-b border-landing-line px-4 py-2.5">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md bg-landing-card px-3 py-1 text-center font-mono text-xs text-landing-muted">
                …/sua-estetica/admin/catalogo
              </span>
            </div>
            <Image
              src="/landing/telas-admin/catalogo-precos.webp"
              alt="Tela real do Catálogo do Astro: os tipos de veículo da estética e o preço de cada serviço para Hatch, Sedan, SUV, Picape pequena e Picape grande"
              width={1200}
              height={650}
              sizes="(min-width: 64rem) 46rem, 100vw"
              className="block h-auto w-full"
            />
          </div>
          <div className="absolute right-0 bottom-0 w-[32%] max-w-[min(14rem,calc((100svh-15rem)/2.163))] overflow-hidden rounded-[1.4rem] border-4 border-[#27272a] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.95)]">
            <Image
              src="/landing/fluxo/4-acrescimo.webp"
              alt="Tela real do cliente: aviso de que o valor pode ter acréscimo de até 30% pela condição do veículo"
              width={600}
              height={1298}
              sizes="14rem"
              className="block h-auto w-full"
            />
          </div>
        </Revelar>
      </div>
    </section>
  );
}

// O fluxo do cliente com os prints do celular. O titulo vai para dentro da
// vitrine (coluna do texto), para o celular usar a altura inteira da tela.
function ComoFunciona() {
  return (
    <section
      id="agendar"
      aria-labelledby="t-agendar"
      className="landing-tela pt-24 pb-8"
    >
      <div className="landing-wrap">
        <Revelar>
          <Vitrine
            cabecalho={
              <div className="grid gap-3">
                <h2
                  id="t-agendar"
                  className="text-[clamp(1.8rem,3.2vw,2.5rem)] leading-tight font-bold tracking-tight text-balance"
                >
                  Você manda o link. O cliente faz o resto.
                </h2>
                <p className="text-landing-muted lg:text-lg">
                  Do clique no link ao carro na sua porta, sem nenhuma mensagem
                  trocada. A confirmação e os lembretes chegam por e-mail e
                  Telegram.
                </p>
              </div>
            }
          />
        </Revelar>
      </div>
    </section>
  );
}

const RECURSOS = [
  {
    icone: CalendarDays,
    titulo: "Horários automáticos",
    texto:
      "Calculados pela grade de cada dia e por quantos carros você atende ao mesmo tempo.",
  },
  {
    icone: Tag,
    titulo: "Preço por porte",
    texto: "Um valor para cada tipo de veículo, em cada serviço.",
  },
  {
    icone: Diamond,
    titulo: "PIX copia e cola",
    texto: "Com a sua chave. O dinheiro cai direto na sua conta.",
  },
  {
    icone: Bell,
    titulo: "Lembretes",
    texto:
      "Confirmação, lembrete e aviso de cancelamento por e-mail e Telegram.",
  },
  {
    icone: Clock,
    titulo: "Prazo de cancelamento",
    texto: "Você define até quantas horas antes o cliente pode cancelar.",
  },
  {
    icone: ChartColumn,
    titulo: "Financeiro",
    texto: "Receita por período e por serviço, e quanto falta receber.",
  },
  {
    icone: Palette,
    titulo: "Sua marca",
    texto: "Logo, cor, endereço e link próprio da estética.",
  },
  {
    icone: ShieldCheck,
    titulo: "Dados separados",
    texto: "Os dados da sua estética ficam isolados dos de qualquer outra.",
  },
];

// Oito recursos, quatro de cada lado de um celular com uma tela real do
// cliente (como na referencia de landing de app que o Andre trouxe). No
// celular e no tablet o aparelho sai e os cartoes ficam em grade.
function Recursos() {
  const cartao = (
    { icone: Icone, titulo, texto }: (typeof RECURSOS)[number],
    i: number,
  ) => (
    <Revelar key={titulo} atraso={(i % 4) * 0.08} className="h-full">
      <div className="flex h-full items-start gap-3 rounded-3xl border border-landing-line bg-landing-card p-4 transition-colors hover:border-landing-line-strong lg:p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-landing-blue/18 text-landing-glow">
          <Icone className="size-5" />
        </span>
        <div className="grid gap-0.5">
          <h3 className="font-bold">{titulo}</h3>
          <p className="text-sm leading-snug text-landing-muted">{texto}</p>
        </div>
      </div>
    </Revelar>
  );
  return (
    <Secao
      id="recursos"
      titulo="Tudo o que a agenda da sua estética precisa"
      subtitulo="Agendamento, pagamento e acompanhamento num lugar só."
    >
      <div className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
          {RECURSOS.slice(0, 4).map(cartao)}
        </div>
        <Revelar atraso={0.1} className="relative hidden lg:block">
          <div
            aria-hidden
            className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.45),transparent)]"
          />
          <div className="relative aspect-[600/1298] h-[min(54svh,30rem)] overflow-hidden rounded-[1.6rem] border-4 border-[#27272a] bg-black shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)]">
            <Image
              src="/landing/fluxo/6-detalhes.webp"
              alt="Tela real do cliente: agendamento reservado, com data, serviço, veículo e valor"
              width={600}
              height={1298}
              sizes="15rem"
              className="block h-full w-auto"
            />
          </div>
        </Revelar>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
          {RECURSOS.slice(4).map((r, i) => cartao(r, i + 4))}
        </div>
      </div>
    </Secao>
  );
}

function Aparelhos() {
  const itens = [
    {
      icone: Smartphone,
      titulo: "Para o cliente",
      texto:
        "Agenda pelo celular em poucos toques, a qualquer hora, inclusive com a estética fechada.",
    },
    {
      icone: Monitor,
      titulo: "Para você",
      texto:
        "Acompanha o painel no computador da recepção ou no celular, no meio do pátio.",
    },
  ];
  return (
    <Secao
      alternada
      titulo="No celular do cliente e no seu computador"
      subtitulo="Funciona no navegador. Ninguém precisa instalar aplicativo."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {itens.map(({ icone: Icone, titulo, texto }, i) => (
          <Revelar
            key={titulo}
            atraso={i * 0.12}
            className="grid gap-2 rounded-3xl border border-landing-line bg-landing-card p-6 sm:p-8"
          >
            <Icone className="size-7 text-landing-glow" />
            <h3 className="text-xl font-bold">{titulo}</h3>
            <p className="text-landing-muted">{texto}</p>
          </Revelar>
        ))}
      </div>
    </Secao>
  );
}

function Preco() {
  return (
    <section
      id="preco"
      aria-labelledby="t-preco"
      className="landing-tela relative overflow-hidden pt-22 pb-10 md:pb-12"
    >
      <svg
        aria-hidden
        viewBox="0 0 1000 420"
        className="pointer-events-none absolute top-20 left-1/2 w-[60rem] max-w-none -translate-x-1/2"
      >
        <ellipse
          cx="500"
          cy="210"
          rx="480"
          ry="160"
          fill="none"
          stroke="#ffffff"
          strokeOpacity=".16"
        />
        <ellipse
          cx="500"
          cy="210"
          rx="380"
          ry="118"
          fill="none"
          stroke="#ffffff"
          strokeOpacity=".1"
          strokeDasharray="3 10"
        />
      </svg>
      <div className="landing-wrap relative">
        <Revelar className="vidro mx-auto mb-4 grid w-fit max-w-2xl justify-items-center gap-2 rounded-3xl px-6 py-4 text-center sm:px-8">
          <h2
            id="t-preco"
            className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight font-bold tracking-tight"
          >
            Um plano, tudo incluído
          </h2>
          <p className="text-lg text-zinc-300">
            Sem limite de agendamentos, clientes ou serviços.
          </p>
        </Revelar>
        <Revelar atraso={0.1}>
          <Plano />
        </Revelar>
      </div>
    </section>
  );
}

const PERGUNTAS = [
  {
    p: "Meu cliente precisa baixar um aplicativo?",
    r: "Não. O Astro abre no navegador do celular ou do computador. O cliente entra pelo link da sua estética e cria a conta na hora de agendar.",
  },
  {
    p: "Como funciona o pagamento por PIX?",
    r: "O cliente copia a sua chave PIX e paga pelo banco dele. O valor cai direto na sua conta. Depois você confirma o pagamento no painel com um toque.",
  },
  {
    p: "E se o carro chegar mais sujo que o normal?",
    r: "Você lança um acréscimo de até 30% ao confirmar o atendimento. O cliente é avisado antes de agendar, e a diferença é paga no local.",
  },
  {
    p: "Consigo escolher quantos carros atendo ao mesmo tempo?",
    r: "Sim. Você define a grade de cada dia da semana e a capacidade. O Astro só oferece horários que ainda têm vaga.",
  },
  {
    p: "Posso mudar os tipos de veículo e os preços?",
    r: "Sim. Os tipos de veículo e o preço de cada serviço para cada tipo ficam no seu painel, e você muda quando quiser.",
  },
  {
    p: "O cliente pode cancelar?",
    r: "Pode, até o prazo que você definir, por exemplo 2 horas antes. Depois disso, o Astro orienta o cliente a falar com a estética.",
  },
];

function Duvidas() {
  return (
    <Secao id="duvidas" titulo="Perguntas frequentes">
      <div className="mx-auto grid max-w-3xl gap-3">
        {PERGUNTAS.map(({ p, r }, i) => (
          <Revelar key={p} atraso={i * 0.05}>
            <details className="group rounded-2xl border border-landing-line bg-landing-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold [&::-webkit-details-marker]:hidden">
                {p}
                <Plus className="size-5 shrink-0 text-landing-glow transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 text-landing-muted">{r}</p>
            </details>
          </Revelar>
        ))}
      </div>
    </Secao>
  );
}

// Chamada final no mesmo cartao de destaque do painel do Admin (o de
// faturamento): degrade azul, aneis de orbita no canto e a luz que corre pela
// borda (.borda-viva). Assim a landing usa um elemento que o dono vai
// reconhecer quando abrir o Astro.
function FaixaFinal() {
  return (
    <section aria-labelledby="t-fim" className="landing-tela pt-22 pb-12">
      <div className="landing-wrap">
        <Revelar>
          <div
            className="borda-viva relative grid justify-items-center gap-5 overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:py-16"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
              boxShadow:
                "0 24px 60px -24px color-mix(in srgb, var(--color-astro-blue) 80%, transparent), 0 0 50px -10px color-mix(in srgb, var(--color-astro-blue-bright) 45%, transparent)",
            }}
          >
            {/* Aneis de orbita decorativos no canto, como no cartao do Admin */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full border border-white/20 shadow-[0_0_0_40px_rgba(255,255,255,0.04),0_0_0_90px_rgba(255,255,255,0.03)]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-28 h-64 w-64 rounded-full border border-white/15 shadow-[0_0_0_36px_rgba(255,255,255,0.03)]"
            />
            <h2
              id="t-fim"
              className="relative max-w-2xl text-[clamp(1.8rem,3.6vw,2.7rem)] leading-tight font-extrabold text-balance"
            >
              Pronto para colocar a agenda da sua estética no ar?
            </h2>
            <p className="relative max-w-xl text-white/90">
              Menos tempo respondendo mensagem, mais tempo no polimento.
            </p>
            <a href="#preco" className="landing-btn landing-btn-light relative">
              Começar agora
            </a>
          </div>
        </Revelar>
      </div>
    </section>
  );
}

const NAVEGACAO = [
  { href: "#comparativo", rotulo: "Comparativo" },
  { href: "#por-dentro", rotulo: "Por dentro" },
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#preco", rotulo: "Preço" },
  { href: "#duvidas", rotulo: "Dúvidas" },
];

const PRODUTO = [
  { href: "#agendar", rotulo: "Como o cliente agenda" },
  { href: "#preco", rotulo: "Começar agora" },
];

// Rodape em cartao, com o logo do Astro grande no fim, inteiro. O logo sobe
// ao aparecer.
function Rodape() {
  return (
    <footer className="landing-tela landing-wrap pt-10 pb-10">
      <div className="overflow-hidden rounded-[2rem] border border-landing-line bg-landing-surface">
        <div className="grid gap-10 px-6 pt-10 sm:px-12 sm:pt-14">
          <div className="flex flex-wrap justify-between gap-10">
            <div className="flex flex-wrap gap-14">
              <ColunaRodape titulo="Navegação" links={NAVEGACAO} />
              <ColunaRodape titulo="Astro" links={PRODUTO} />
            </div>
            <a
              href="#topo"
              className="group inline-flex h-fit items-center gap-1.5 text-sm text-landing-muted transition-colors hover:text-landing-ink"
            >
              Voltar ao topo
              <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t border-landing-line pt-6 text-xs text-landing-muted">
            <span>© 2026 Astro. Todos os direitos reservados.</span>
            <span>Agendamento online para estéticas automotivas</span>
          </div>
        </div>

        <div
          aria-hidden
          className="mx-auto mt-6 mb-6 w-full max-w-md px-4 sm:mb-8 sm:px-10"
        >
          <Revelar>
            <Image
              src="/logo-astro-branco.png"
              alt=""
              width={712}
              height={219}
              sizes="(min-width: 72rem) 70rem, 100vw"
              className="h-auto w-full opacity-95"
            />
          </Revelar>
        </div>
      </div>
    </footer>
  );
}

function ColunaRodape({
  titulo,
  links,
}: {
  titulo: string;
  links: { href: string; rotulo: string }[];
}) {
  return (
    <nav aria-label={titulo} className="grid content-start gap-3">
      <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-landing-muted uppercase">
        {titulo}
      </span>
      {links.map((l) => (
        <a
          key={l.rotulo}
          href={l.href}
          className="text-landing-ink/90 transition-colors hover:text-landing-glow"
        >
          {l.rotulo}
        </a>
      ))}
    </nav>
  );
}
