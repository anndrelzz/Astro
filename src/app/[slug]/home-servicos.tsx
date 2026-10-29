"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Car, ChevronRight, Clock, Info } from "lucide-react";

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracaoMin: number;
  /// segmentoId -> preco. Chave e id, nao nome: a estetica pode renomear o
  /// segmento sem que os precos se percam.
  precos: Record<string, number>;
};

// O carro que define o preco exibido: o principal da garagem do cliente.
export type CarroPreco = {
  segmentoId: string;
  segmentoNome: string;
  nome: string;
};

const reais = (valor: number, centavos = true) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: centavos ? 2 : 0,
    maximumFractionDigits: centavos ? 2 : 0,
  });

function formatarDuracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// Preco do card. Com carro cadastrado, o valor exato do tipo dele (RF04); sem
// carro, a faixa do mais barato ao mais caro entre os tipos da estetica.
// null = sem preco: acontece na janela entre o Admin criar um tipo novo e
// preencher a tabela (o R$ 0 provisorio ja chega aqui fora do mapa). O card
// desse servico nem aparece, e o agendamento tambem e recusado no servidor.
function precoDoCard(servico: Servico, carro: CarroPreco | null) {
  if (carro) {
    const valor = servico.precos[carro.segmentoId];
    return valor === undefined ? null : reais(valor);
  }
  const valores = Object.values(servico.precos);
  if (valores.length === 0) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max
    ? reais(min)
    : `${reais(min, false)} – ${reais(max, false)}`;
}

// Tela 06 — lista de servicos (RF01, RF04).
//
// Sem o seletor de tipo de carro: ele confundia o cliente, que nao sabia em
// qual tipo o carro dele se encaixava. O preco ja vem do carro cadastrado, e
// o aviso embaixo do titulo explica que o valor depende do tipo.
//
// No celular e uma lista vertical, e nao um carrossel: no carrossel o cliente
// via um servico e meio e nao sabia que havia outros. O card inteiro e o
// botao de agendar.
export function HomeServicos({
  slug,
  servicos,
  carro,
  logado,
  temVeiculo,
}: {
  slug: string;
  servicos: Servico[];
  carro: CarroPreco | null;
  logado: boolean;
  temVeiculo: boolean;
}) {
  // RN04 — logado sem veiculo cai no aviso "sem veiculo" (tela 07) ao agendar.
  const [semVeiculo, setSemVeiculo] = useState(false);

  // So entra o que tem preco para o carro do cliente (ou, sem carro, para
  // algum tipo). Os outros tipos de carro seguem vendo o servico normalmente.
  const disponiveis = servicos.flatMap((servico) => {
    const preco = precoDoCard(servico, carro);
    return preco === null ? [] : [{ servico, preco }];
  });

  // Destino do agendamento conforme estado do usuario.
  function hrefAgendar(servicoId: string) {
    return logado
      ? `/${slug}/agendar/${servicoId}`
      : `/${slug}/login?callbackUrl=/${slug}/agendar/${servicoId}`;
  }

  return (
    <section aria-labelledby="titulo-servicos" className="mt-2 lg:mt-3">
      <h2
        id="titulo-servicos"
        className="text-xl font-bold text-zinc-900 lg:text-2xl"
      >
        Serviços
      </h2>
      <p className="mt-2 flex items-start gap-2 rounded-2xl border border-zinc-200/80 bg-white/70 px-3.5 py-2.5 text-sm text-zinc-600 backdrop-blur">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-astro-blue" />
        {carro ? (
          <span>
            Preços para o seu{" "}
            <strong className="font-semibold text-zinc-900">
              {carro.nome}
            </strong>{" "}
            ({carro.segmentoNome}). O valor muda conforme o tipo do carro.
          </span>
        ) : (
          <span>
            O preço varia conforme o tipo do carro. O valor exato aparece ao
            cadastrar o seu.
          </span>
        )}
      </p>

      <ul className="mt-4 grid gap-3 lg:grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] lg:gap-4">
        {disponiveis.map(({ servico, preco }) => {
          const conteudo = (
            <>
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-astro-blue-bright), color-mix(in srgb, var(--color-astro-blue) 70%, black))",
                }}
              >
                <Car className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug text-zinc-900">
                  {servico.nome}
                </span>
                {servico.descricao && (
                  <span className="mt-0.5 line-clamp-1 text-sm text-zinc-500">
                    {servico.descricao}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold text-zinc-900 tabular-nums">
                    {preco}
                  </span>
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatarDuracao(servico.duracaoMin)}
                  </span>
                </span>
              </span>

              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600" />
            </>
          );
          const classe =
            "group flex w-full items-center gap-3.5 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 text-left shadow-[0_8px_24px_-18px_rgb(15_23_42/0.3)] backdrop-blur transition hover:border-zinc-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-astro-blue";

          return (
            <li key={servico.id}>
              {logado && !temVeiculo ? (
                <button
                  type="button"
                  onClick={() => setSemVeiculo(true)}
                  aria-label={`Agendar ${servico.nome}`}
                  className={classe}
                >
                  {conteudo}
                </button>
              ) : (
                <Link
                  href={hrefAgendar(servico.id)}
                  aria-label={`Agendar ${servico.nome}`}
                  className={classe}
                >
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {servicos.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500">
          Nenhum serviço cadastrado ainda.
        </p>
      )}

      {servicos.length > 0 && disponiveis.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500">
          Nenhum serviço disponível para esse tipo de veículo no momento.
        </p>
      )}

      {/* Tela 07 — aviso "sem veiculo" (RN04). Fica no centro da tela e entra
          subindo. Vai direto para o <body>:
          aqui dentro ele ficaria preso na camada da pagina (o `isolate` da
          ClienteShell) e a barra do cliente, que vem do layout, passaria por
          cima dele. */}
      {semVeiculo &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <button
              aria-label="Fechar"
              onClick={() => setSemVeiculo(false)}
              className="absolute inset-0 animate-[escurecer_250ms_ease-out] bg-black/40 backdrop-blur-sm motion-reduce:animate-none"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-sem-veiculo"
              className="relative w-full max-w-sm animate-[subir_400ms_cubic-bezier(0.22,1,0.36,1)] rounded-3xl bg-white p-6 text-center shadow-2xl motion-reduce:animate-none"
            >
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-astro-blue), var(--color-astro-blue-bright))",
                  boxShadow:
                    "0 0 0 8px color-mix(in srgb, var(--color-astro-blue) 15%, transparent)",
                }}
              >
                <Car className="h-6 w-6" />
              </span>
              <h2
                id="titulo-sem-veiculo"
                className="mt-5 text-lg font-bold text-zinc-900"
              >
                Cadastre seu veículo primeiro
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                O preço e o horário dependem do tipo do carro. Leva menos de um
                minuto.
              </p>

              {/* Fecha este aviso ao entregar a vez para o cadastro. Como o
                cadastro e rota interceptada, ele abre como pop-up SEM desmontar
                esta pagina — e sem fechar aqui, os dois ficariam empilhados,
                cada um com seu proprio fundo escurecido. Um de cada vez. */}
              <Link
                onClick={() => setSemVeiculo(false)}
                href={`/${slug}/veiculos/novo?callbackUrl=/${slug}`}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_var(--color-astro-blue)] transition hover:brightness-110"
              >
                Cadastrar veículo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setSemVeiculo(false)}
                className="mt-2 w-full rounded-full py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                Agora não
              </button>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
