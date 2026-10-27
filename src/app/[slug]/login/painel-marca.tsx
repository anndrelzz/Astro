import { Check } from "lucide-react";

export type Estetica = { nome: string; logoUrl: string | null };

// Identidade da estetica (RF14). O cliente chega aqui por um link que a
// propria estetica divulgou; sem o nome e o logo na tela, ele nao tem como
// confirmar que caiu no lugar certo. Sempre sobre fundo colorido/escuro.
export function MarcaEstetica({ estetica, grande = false }: { estetica: Estetica; grande?: boolean }) {
  const iniciais = estetica.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`flex items-center ${grande ? "gap-3.5" : "gap-2.5"}`}>
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/20 bg-white/10 ${
          grande ? "h-14 w-14 rounded-2xl" : "h-9 w-9 rounded-lg"
        }`}
      >
        {estetica.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estetica.logoUrl} alt={`Logo ${estetica.nome}`} className="h-full w-full object-contain" />
        ) : (
          <span className={`font-semibold tracking-wide text-white ${grande ? "text-base" : "text-xs"}`}>{iniciais}</span>
        )}
      </div>
      <span className={`truncate font-semibold text-white ${grande ? "text-lg" : "text-sm"}`}>{estetica.nome}</span>
    </div>
  );
}

// Fundo do cartao de login e cadastro: o degrade da cor da estetica (RF13),
// o mesmo do cartao de faturamento do painel.
export const FUNDO_ESTETICA =
  "radial-gradient(120% 140% at 0% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)";

// Camadas de "papel recortado" (so no computador). Folhas empilhadas vindas
// da direita, cada uma com a borda esquerda em curva e uma sombra projetada
// sobre a de baixo. Da mais funda (cor da estetica escurecida) ate a de cima,
// que e a superficie escura onde fica o formulario.
//
// A sombra fica no elemento de fora (filter) e o recorte no de dentro (mask):
// se os dois estivessem no mesmo elemento, a mascara cortaria a sombra junto.
const CURVAS = [
  "M34 0C14 14 46 30 26 50S10 80 32 100H100V0Z",
  "M30 0C12 18 42 32 22 52S10 84 28 100H100V0Z",
  "M24 0C8 16 36 34 18 54S8 86 22 100H100V0Z",
  "M16 0C2 18 26 34 10 54S4 86 16 100H100V0Z",
];
const CAMADAS = [
  { largura: "82%", cor: "color-mix(in srgb, var(--color-astro-blue) 82%, black)" },
  { largura: "73%", cor: "color-mix(in srgb, var(--color-astro-blue) 58%, black)" },
  { largura: "64%", cor: "color-mix(in srgb, var(--color-astro-blue) 32%, #0b0b0f)" },
  { largura: "56%", cor: "#0b0b0f" },
];

function mascara(caminho: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${caminho}'/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return { WebkitMaskImage: url, maskImage: url, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
}

export function CamadasPapel() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {CAMADAS.map((c, i) => (
        <div
          key={c.largura}
          className="absolute inset-y-0 right-0"
          style={{ width: c.largura, filter: "drop-shadow(-8px 0 10px rgba(0,0,0,0.55))" }}
        >
          <div className="h-full w-full" style={{ backgroundColor: c.cor, ...mascara(CURVAS[i]) }} />
        </div>
      ))}
    </div>
  );
}

// Conteudo do lado da estetica: logo, nome e a frase. Fica sobre o degrade do
// cartao; no computador ocupa a coluna da esquerda, no celular o topo.
export function PainelMarca({ modo, estetica }: { modo: "login" | "cadastro"; estetica: Estetica }) {
  const eLogin = modo === "login";

  return (
    <aside className="relative z-10 px-6 pt-7 pb-6 text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
      {/* Aneis e bolhas de vidro, decorativos */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full border border-white/20 shadow-[0_0_0_44px_rgba(255,255,255,0.04),0_0_0_100px_rgba(255,255,255,0.03)] lg:-left-16"
      />
      <span aria-hidden className="bolha absolute top-[34%] left-[10%] hidden h-14 w-14 lg:block" />
      <span aria-hidden className="bolha absolute top-[6%] right-[6%] h-9 w-9 lg:top-[42%] lg:right-[18%] lg:h-10 lg:w-10" />
      <span aria-hidden className="bolha absolute top-[52%] left-[34%] hidden h-7 w-7 lg:block" />

      <div className="relative">
        <MarcaEstetica estetica={estetica} grande />
      </div>

      <div className="relative mt-6 lg:mt-0">
        {eLogin ? (
          <>
            <h2 className="text-3xl leading-tight font-bold lg:text-4xl">Bom ter você de volta.</h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/80">
              Entre para acompanhar seus agendamentos, veículos e histórico de serviços.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl leading-tight font-bold lg:text-4xl">Agende sem ligar nem esperar.</h2>
            <ul className="mt-5 hidden space-y-3 lg:block">
              {["Sem ligações ou retornos lentos", "Receba lembretes automáticos", "Pagamento via PIX ou no local"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                )
              )}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
