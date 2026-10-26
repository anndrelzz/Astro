import {
  ArrowUp,
  Bell,
  CalendarDays,
  Car,
  ChartColumn,
  Check,
  Clock,
  Diamond,
  List,
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
import { ThemeColor } from "@/components/ui/theme-color";
import { Heroi } from "./heroi";
import { Plano } from "./plano";
import { PorDentro } from "./por-dentro";
import { ConfigAnimacao, Revelar } from "./revelar";

// Landing de vendas do Astro. Estrutura de secoes inspirada na pagina da
// Orbita (concorrente), com o visual proprio do Astro: imagem do ceu no
// topo e preto e branco com detalhes em azul, como as telas do app.
//
// Este arquivo e componente de servidor e guarda as secoes sem interacao.
// O que se mexe ou responde a clique fica em arquivos "use client":
// heroi.tsx (topo e vitrine), por-dentro.tsx (abas), plano.tsx (preco) e
// revelar.tsx (secoes surgindo ao rolar).
//
// So promete o que o Astro faz. Os numeros da secao de comparacao vem da
// pesquisa com 5 esteticas do RFC (secao 1.2).

// Manrope so na landing: e a voz de "pagina de vendas". O app continua em
// Geist (layout.tsx).
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export function Landing() {
  return (
    <ConfigAnimacao>
      <ThemeColor color="#09090b" />
      <div className={`landing ${manrope.className} min-h-dvh overflow-x-hidden bg-landing-night text-landing-ink`}>
        <Heroi />
        <Comparativo />
        <Secao id="por-dentro" alternada titulo="Conheça o Astro por dentro" subtitulo="O painel que você usa para acompanhar a estética, do primeiro horário do dia ao fechamento do mês.">
          <Revelar>
            <PorDentro />
          </Revelar>
        </Secao>
        <PrecoPorCarro />
        <ComoFunciona />
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
  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className={`scroll-mt-24 py-16 md:py-24 ${alternada ? "border-y border-landing-line bg-landing-surface" : ""}`}
    >
      <div className="landing-wrap">
        <Revelar className="mx-auto mb-12 grid max-w-2xl justify-items-center gap-4 text-center">
          <h2 id={idTitulo} className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight font-bold tracking-tight text-balance">
            {titulo}
          </h2>
          {subtitulo && <p className="text-lg text-landing-muted">{subtitulo}</p>}
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
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <Revelar className="grid content-start gap-5 rounded-3xl border border-landing-line bg-landing-surface p-6 sm:p-8">
          <h3 className="text-base font-extrabold tracking-widest text-landing-muted uppercase">Agenda pelo WhatsApp</h3>
          <ul className="grid gap-4">
            {SEM_ASTRO.map((t) => (
              <li key={t} className="flex items-start gap-3 text-landing-muted">
                <X className="mt-0.5 size-6 shrink-0 rounded-full bg-red-400/12 p-1 text-red-400" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </Revelar>
        <Revelar atraso={0.12} className="grid content-start gap-5 rounded-3xl border border-landing-glow/45 bg-[linear-gradient(180deg,rgba(37,99,235,0.24),rgba(37,99,235,0.08))] p-6 sm:p-8">
          <h3 className="text-base font-extrabold tracking-widest text-landing-glow uppercase">Com o Astro</h3>
          <ul className="grid gap-4">
            {COM_ASTRO.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check className="mt-0.5 size-6 shrink-0 rounded-full bg-emerald-400/14 p-1 text-emerald-400" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </Revelar>
      </div>
      <p className="mt-8 text-center text-landing-muted">Você percebe a diferença na primeira semana de agenda cheia.</p>
    </Secao>
  );
}

function PrecoPorCarro() {
  return (
    <section aria-labelledby="t-preco-carro" className="py-16 md:py-24">
      <div className="landing-wrap grid items-center gap-12 lg:grid-cols-2">
        <Revelar className="grid gap-5">
          <h2 id="t-preco-carro" className="text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-tight">
            Preço certo para cada carro.
          </h2>
          <p className="text-lg text-landing-muted">
            Lavar um SUV não custa o mesmo que lavar um hatch. No Astro, cada serviço tem um preço
            por porte, e o cliente vê o valor do carro dele antes de marcar.
          </p>
          <p className="text-lg text-landing-muted">
            Se o carro chegar em condição pior que o normal, você lança um acréscimo de até 30% ao
            confirmar. O cliente é avisado antes de agendar.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { icone: Tag, texto: "Preço por porte" },
              { icone: Car, texto: "Tipos de veículo seus" },
              { icone: TriangleAlert, texto: "Acréscimo avisado" },
            ].map(({ icone: Icone, texto }) => (
              <span key={texto} className="inline-flex items-center gap-1.5 rounded-full border border-landing-line-strong px-3 py-1.5 text-sm font-semibold">
                <Icone className="size-4 text-landing-glow" />
                {texto}
              </span>
            ))}
          </div>
        </Revelar>

        {/* Prints reais: a tabela de precos do Catalogo (Admin) e, por cima,
            o aviso de acrescimo que o cliente ve antes de pagar. */}
        <Revelar atraso={0.12} className="relative pb-24 sm:pr-28 sm:pb-12">
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
              alt="Tela real do Catálogo do Astro: preço de cada serviço para Hatch, Sedan, SUV, Picape pequena e Picape grande"
              width={1200}
              height={566}
              sizes="(min-width: 64rem) 34rem, 100vw"
              className="block h-auto w-full"
            />
          </div>
          <div className="absolute right-0 bottom-0 w-[30%] max-w-44 overflow-hidden rounded-[1.4rem] border-4 border-[#27272a] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.95)]">
            <Image
              src="/landing/fluxo/4-acrescimo.webp"
              alt="Tela real do cliente: aviso de que o valor pode ter acréscimo de até 30% pela condição do veículo"
              width={600}
              height={1298}
              sizes="12rem"
              className="block h-auto w-full"
            />
          </div>
        </Revelar>
      </div>
    </section>
  );
}

const PASSOS = [
  { titulo: "Escolhe o serviço", texto: "Cadastra o carro e já vê o preço para o porte dele." },
  { titulo: "Escolhe o horário", texto: "Só aparecem horários com vaga, pela sua grade e capacidade." },
  { titulo: "Escolhe como pagar", texto: "PIX copia e cola com a sua chave, ou pagamento no local." },
  { titulo: "Recebe a confirmação", texto: "Por e-mail e Telegram, com lembretes 24 horas e 2 horas antes." },
];

function ComoFunciona() {
  return (
    <Secao id="agendar" alternada titulo="Você manda o link. O cliente faz o resto." subtitulo="Do clique no link ao carro na sua porta, sem nenhuma mensagem trocada.">
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PASSOS.map((p, i) => (
          <li key={p.titulo}>
            <Revelar atraso={i * 0.1} className="grid h-full content-start gap-3 rounded-3xl border border-landing-line bg-landing-card p-6">
              <span className="font-mono text-sm font-bold text-landing-glow">{i + 1}</span>
              <h3 className="text-lg font-bold">{p.titulo}</h3>
              <p className="text-landing-muted">{p.texto}</p>
            </Revelar>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

const RECURSOS = [
  { icone: CalendarDays, titulo: "Horários automáticos", texto: "Calculados pela grade de cada dia e por quantos carros você atende ao mesmo tempo." },
  { icone: Tag, titulo: "Preço por porte", texto: "Um valor para cada tipo de veículo, em cada serviço." },
  { icone: Diamond, titulo: "PIX copia e cola", texto: "Com a sua chave. O dinheiro cai direto na sua conta." },
  { icone: Bell, titulo: "Lembretes", texto: "Confirmação, lembrete e aviso de cancelamento por e-mail e Telegram." },
  { icone: List, titulo: "Agendamentos por situação", texto: "Confirmados, PIX pendente, no local e concluídos, com busca." },
  { icone: Clock, titulo: "Prazo de cancelamento", texto: "Você define até quantas horas antes o cliente pode cancelar." },
  { icone: ChartColumn, titulo: "Financeiro", texto: "Receita por período e por serviço, e quanto falta receber." },
  { icone: Palette, titulo: "Sua marca", texto: "Logo, cor, endereço e link próprio da estética." },
  { icone: ShieldCheck, titulo: "Dados separados", texto: "Os dados da sua estética ficam isolados dos de qualquer outra." },
];

function Recursos() {
  return (
    <Secao id="recursos" titulo="Tudo o que a agenda da sua estética precisa" subtitulo="Agendamento, pagamento e acompanhamento num lugar só.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map(({ icone: Icone, titulo, texto }, i) => (
          <Revelar key={titulo} atraso={(i % 3) * 0.08} className="h-full">
            <div className="grid h-full content-start gap-3 rounded-3xl border border-landing-line bg-landing-card p-6 transition-colors hover:border-landing-line-strong">
              <span className="grid size-11 place-items-center rounded-xl bg-landing-blue/18 text-landing-glow">
                <Icone className="size-5" />
              </span>
              <h3 className="text-lg font-bold">{titulo}</h3>
              <p className="text-landing-muted">{texto}</p>
            </div>
          </Revelar>
        ))}
      </div>
    </Secao>
  );
}

function Aparelhos() {
  const itens = [
    { icone: Smartphone, titulo: "Para o cliente", texto: "Agenda pelo celular em poucos toques, a qualquer hora, inclusive com a estética fechada." },
    { icone: Monitor, titulo: "Para você", texto: "Acompanha o painel no computador da recepção ou no celular, no meio do pátio." },
  ];
  return (
    <Secao alternada titulo="No celular do cliente e no seu computador" subtitulo="Funciona no navegador. Ninguém precisa instalar aplicativo.">
      <div className="grid gap-5 md:grid-cols-2">
        {itens.map(({ icone: Icone, titulo, texto }, i) => (
          <Revelar key={titulo} atraso={i * 0.12} className="grid gap-2 rounded-3xl border border-landing-line bg-landing-card p-6 sm:p-8">
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
    <section id="preco" aria-labelledby="t-preco" className="relative scroll-mt-24 overflow-hidden py-16 md:py-24">
      <svg aria-hidden viewBox="0 0 1000 420" className="pointer-events-none absolute top-12 left-1/2 w-[60rem] max-w-none -translate-x-1/2">
        <ellipse cx="500" cy="210" rx="480" ry="160" fill="none" stroke="#ffffff" strokeOpacity=".16" />
        <ellipse cx="500" cy="210" rx="380" ry="118" fill="none" stroke="#ffffff" strokeOpacity=".1" strokeDasharray="3 10" />
      </svg>
      <div className="landing-wrap relative">
        <Revelar className="mx-auto mb-8 grid max-w-2xl justify-items-center gap-4 text-center">
          <h2 id="t-preco" className="text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight font-bold tracking-tight">
            Um plano, tudo incluído
          </h2>
          <p className="text-lg text-landing-muted">Sem limite de agendamentos, clientes ou serviços.</p>
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

function FaixaFinal() {
  return (
    <section aria-labelledby="t-fim" className="relative overflow-hidden bg-[linear-gradient(135deg,#1e3a8a_0%,#2563eb_45%,#1e40af_100%)]">
      <svg aria-hidden viewBox="0 0 600 600" className="pointer-events-none absolute -top-32 -right-40 w-[34rem] max-w-none opacity-50">
        <circle cx="300" cy="300" r="280" fill="none" stroke="#fff" strokeOpacity=".25" />
        <circle cx="300" cy="300" r="200" fill="none" stroke="#fff" strokeOpacity=".18" strokeDasharray="3 10" />
        <circle cx="300" cy="300" r="70" fill="#fff" fillOpacity=".12" />
      </svg>
      <Revelar className="landing-wrap relative grid justify-items-center gap-5 py-20 text-center">
        <h2 id="t-fim" className="max-w-2xl text-[clamp(1.8rem,3.6vw,2.7rem)] leading-tight font-extrabold text-balance">
          Pronto para colocar a agenda da sua estética no ar?
        </h2>
        <p className="max-w-xl text-white">Menos tempo respondendo mensagem, mais tempo no polimento.</p>
        <a href="#preco" className="landing-btn landing-btn-light">
          Começar agora
        </a>
      </Revelar>
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

// Rodape em cartao, com o logo do Astro gigante no fim, cortado pela borda
// de baixo (mesma ideia do rodape da Orbita). O corte e feito pela caixa com
// overflow-hidden e altura menor que a do logo; o logo sobe ao aparecer.
function Rodape() {
  return (
    <footer className="landing-wrap py-10">
      <div className="overflow-hidden rounded-[2rem] border border-landing-line bg-landing-surface">
        <div className="grid gap-10 px-6 pt-10 sm:px-12 sm:pt-14">
          <div className="flex flex-wrap justify-between gap-10">
            <div className="flex flex-wrap gap-14">
              <ColunaRodape titulo="Navegação" links={NAVEGACAO} />
              <ColunaRodape titulo="Astro" links={PRODUTO} />
            </div>
            <a href="#topo" className="group inline-flex h-fit items-center gap-1.5 text-sm text-landing-muted transition-colors hover:text-landing-ink">
              Voltar ao topo
              <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t border-landing-line pt-6 text-xs text-landing-muted">
            <span>© 2026 Astro. Todos os direitos reservados.</span>
            <span>Agendamento online para estéticas automotivas</span>
          </div>
        </div>

        {/* Altura da caixa = 78% da altura do logo: corta o pe das letras. */}
        <div aria-hidden className="mt-8 aspect-[712/171] overflow-hidden px-4 sm:px-10">
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

function ColunaRodape({ titulo, links }: { titulo: string; links: { href: string; rotulo: string }[] }) {
  return (
    <nav aria-label={titulo} className="grid content-start gap-3">
      <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-landing-muted uppercase">{titulo}</span>
      {links.map((l) => (
        <a key={l.rotulo} href={l.href} className="text-landing-ink/90 transition-colors hover:text-landing-glow">
          {l.rotulo}
        </a>
      ))}
    </nav>
  );
}
