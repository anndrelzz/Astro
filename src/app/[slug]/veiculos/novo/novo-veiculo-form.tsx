"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ThemeColor } from "@/components/ui/theme-color";
import { InputPlaca } from "@/components/ui/input-placa";

const SEGMENTOS = [
  { value: "HATCH", label: "Hatch" },
  { value: "SEDAN", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "PICKUP", label: "Pickup" },
  { value: "VAN", label: "Van" },
];

// UC02, tela 08 — cadastro de veiculo. RN04: apos salvar, retorna ao fluxo
// de agendamento (callbackUrl) quando acessado a partir do "Agendar".
//
// A tela vive aqui, e nao em page.tsx, porque precisa de estado do formulario
// (client). A pagina virou um Server Component so para poder envolver isto na
// ClienteShell, que consulta a sessao no servidor.
//
// `emModal` troca so o involucro: dentro do pop-up (rota interceptada) o
// cabecalho escuro e o titulo ja vem do casulo, entao aqui sobra o formulario.
// Os campos e as regras sao os mesmos nos dois casos.
//
// cidade/estado sao da estetica, nao do carro — servem so para a faixa de cima
// da placa desenhada (ver InputPlaca). Vem da pagina porque o tenant e lido no
// servidor.
export function NovoVeiculoForm({
  emModal = false,
  cidade,
  estado,
}: {
  emModal?: boolean;
  cidade?: string | null;
  estado?: string | null;
}) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${slug}`;

  const [form, setForm] = useState({
    segmento: "SUV",
    marca: "",
    modelo: "",
    placa: "",
    ano: "",
    cor: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function set(campo: string, valor: string) {
    setForm((a) => ({ ...a, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const resposta = await fetch("/api/veiculos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setCarregando(false);
    if (!resposta.ok) {
      const json = await resposta.json().catch(() => null);
      setErro(json?.error ?? "Não foi possível cadastrar o veículo. Confira os dados.");
      return;
    }

    // No modal usa replace: o veiculo ja foi criado, e um "voltar" que
    // reabrisse o formulario convidaria a cadastrar o mesmo carro de novo.
    if (emModal) router.replace(callbackUrl);
    else router.push(callbackUrl);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-astro-blue focus:outline-none";

  const formulario = (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 ${
        emModal ? "mt-5" : "mt-6"
      }`}
    >
          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 lg:order-1 lg:col-span-2">
              {erro}
            </p>
          )}

          {/* O mockup poe o segmento depois dos dados do carro: primeiro se
              descreve o veiculo, depois se classifica. No celular ele continua
              em primeiro, como estava — a ordem muda so no desktop, via
              `order`, sem mexer na ordem do DOM. */}
          <div className="space-y-1.5 lg:order-7 lg:col-span-2">
            <label className="astro-label">Segmento</label>
            {/* Lista suspensa no celular (um toque, sem ocupar altura) e
                pastilhas no desktop, onde as cinco opcoes cabem numa linha e
                mostram de uma vez o que existe. Os dois escrevem no mesmo
                estado. */}
            <select
              value={form.segmento}
              onChange={(e) => set("segmento", e.target.value)}
              className={`${inputCls} lg:hidden`}
            >
              {SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="hidden flex-wrap gap-2 lg:flex">
              {SEGMENTOS.map((s) => {
                const ativo = form.segmento === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set("segmento", s.value)}
                    aria-pressed={ativo}
                    className={
                      ativo
                        ? "flex items-center gap-1.5 rounded-xl bg-astro-bg px-4 py-2.5 text-sm font-semibold text-white"
                        : "rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-300"
                    }
                  >
                    {ativo && (
                      <span className="h-1.5 w-1.5 rounded-full bg-astro-blue-bright" />
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* RN01 — o segmento e o que decide o preco. A dica fica colada na
                escolha, que e onde ela muda a decisao. */}
            <p className="pt-1 text-xs text-zinc-500">
              O segmento define o preço do serviço.
            </p>
          </div>

          <div className="space-y-1.5 lg:order-2">
            <label className="astro-label">Marca</label>
            <input
              className={inputCls}
              placeholder="Ex: Jeep"
              value={form.marca}
              onChange={(e) => set("marca", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 lg:order-3">
            <label className="astro-label">Modelo</label>
            <input
              className={inputCls}
              placeholder="Ex: Compass Limited"
              value={form.modelo}
              onChange={(e) => set("modelo", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 lg:order-5">
            <label className="astro-label">Placa</label>
            <InputPlaca
              valor={form.placa}
              aoMudar={(v) => set("placa", v)}
              cidade={cidade}
              estado={estado}
            />
          </div>

          <div className="space-y-1.5 lg:order-4">
            <label className="astro-label">Ano</label>
            <input
              type="number"
              className={inputCls}
              placeholder="2023"
              value={form.ano}
              onChange={(e) => set("ano", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5 lg:order-6">
            <label className="astro-label">Cor</label>
            <input
              className={inputCls}
              placeholder="Ex: Preto Carbon"
              value={form.cor}
              onChange={(e) => set("cor", e.target.value)}
              required
            />
          </div>

      {/* Na tela cheia do celular so o botao de enviar, como estava — quem
          volta usa a seta do cabecalho escuro. No desktop e dentro do modal
          nao ha essa seta, entao o cancelar precisa existir aqui. */}
      <div
        className={`lg:order-8 lg:col-span-2 lg:flex lg:flex-row-reverse lg:gap-3 ${
          emModal ? "flex flex-col-reverse gap-2 lg:gap-3" : ""
        }`}
      >
        <button
          type="submit"
          disabled={carregando}
          className="mt-2 w-full rounded-xl bg-astro-blue py-3.5 text-sm font-semibold text-white shadow-lg shadow-astro-blue/25 disabled:opacity-50 lg:mt-0 lg:flex-1"
        >
          {carregando ? "Salvando..." : "Cadastrar veículo"}
        </button>

        {emModal ? (
          // Dentro do modal, cancelar e voltar no historico — a rota
          // interceptada trocou a URL, e um link para o callbackUrl empilharia
          // mais uma entrada em vez de desfazer a que abriu o pop-up.
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-xl border border-zinc-200 py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 lg:w-auto lg:px-8"
          >
            Cancelar
          </button>
        ) : (
          <Link
            href={callbackUrl}
            className="hidden items-center justify-center rounded-xl border border-zinc-200 px-8 py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 lg:flex"
          >
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );

  // Dentro do pop-up o casulo (ModalRota) ja desenhou o fundo, o titulo e o
  // botao de fechar. Aqui sobra o formulario.
  if (emModal) return formulario;

  return (
    <div className="min-h-dvh bg-white lg:min-h-0 lg:bg-transparent">
      <ThemeColor color="#0b1120" />
      {/* Cabecalho escuro — celular. No desktop o titulo vem da casca. */}
      <div className="astro-dark px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href={callbackUrl}
            aria-label="Voltar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-semibold text-white">Novo veículo</h1>
          <span className="h-11 w-11" />
        </div>
      </div>

      {/* Sheet claro no celular; cartao unico no desktop. A largura e travada
          em 48rem: num monitor largo, um formulario esticado de ponta a ponta
          deixa os campos absurdamente longos para dados curtos como ano e cor. */}
      <div className="mx-auto -mt-4 max-w-md rounded-t-3xl bg-white px-5 pb-10 pt-6 lg:mx-0 lg:mt-0 lg:max-w-none lg:rounded-none lg:bg-transparent lg:px-8 lg:pt-0">
        <div className="lg:max-w-3xl lg:rounded-2xl lg:border lg:border-zinc-100 lg:bg-white lg:p-7 lg:shadow-sm">
          <p className="astro-label">Passo 01 · Dados do veículo</p>
          <h2 className="mt-1 text-2xl font-bold text-zinc-900 lg:text-xl">
            Sobre o veículo
          </h2>
          {formulario}
        </div>
      </div>
    </div>
  );
}
