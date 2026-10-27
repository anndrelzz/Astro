import { Check } from "lucide-react";

export type Estetica = { nome: string; logoUrl: string | null };

// Identidade da estetica (RF14). O cliente chega aqui por um link que a
// propria estetica divulgou; sem o nome e o logo na tela, ele nao tem como
// confirmar que caiu no lugar certo. Sempre sobre fundo colorido/escuro.
export function MarcaEstetica({
  estetica,
  grande = false,
}: {
  estetica: Estetica;
  grande?: boolean;
}) {
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
          <img
            src={estetica.logoUrl}
            alt={`Logo ${estetica.nome}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span
            className={`font-semibold tracking-wide text-white ${grande ? "text-base" : "text-xs"}`}
          >
            {iniciais}
          </span>
        )}
      </div>
      <span
        className={`truncate font-semibold text-white ${grande ? "text-lg" : "text-sm"}`}
      >
        {estetica.nome}
      </span>
    </div>
  );
}

// Painel de marca das telas de login e cadastro: o lado colorido do cartao,
// na cor da estetica (RF13), com o mesmo degrade e os mesmos aneis do cartao
// de faturamento do painel. A borda que encosta no formulario e uma curva
// (.painel-auth, em globals.css). No celular vira a faixa do topo do cartao.
export function PainelMarca({
  modo,
  estetica,
}: {
  modo: "login" | "cadastro";
  estetica: Estetica;
}) {
  const eLogin = modo === "login";

  return (
    // Brilho branco suave contornando a curva. Fica no elemento de fora: a
    // mascara do de dentro cortaria a sombra junto com o resto.
    <aside
      className="relative lg:absolute lg:inset-y-0 lg:left-0 lg:w-[56%]"
      style={{
        filter:
          "drop-shadow(0 0 10px rgba(255,255,255,0.28)) drop-shadow(0 0 2px rgba(255,255,255,0.35))",
      }}
    >
      <div
        className="painel-auth relative h-full overflow-hidden px-6 pt-7 pb-20 text-white lg:flex lg:flex-col lg:justify-between lg:p-10 lg:pr-[14%]"
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        }}
      >
        {/* Aneis e bolhas de vidro, decorativos */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full border border-white/20 shadow-[0_0_0_44px_rgba(255,255,255,0.04),0_0_0_100px_rgba(255,255,255,0.03)]"
        />
        <span
          aria-hidden
          className="bolha absolute top-[34%] left-[10%] hidden h-14 w-14 lg:block"
        />
        <span
          aria-hidden
          className="bolha absolute top-[5%] right-[7%] h-9 w-9 lg:top-[38%] lg:right-[22%] lg:h-10 lg:w-10"
        />
        <span
          aria-hidden
          className="bolha absolute top-[48%] left-[38%] hidden h-8 w-8 lg:block"
        />

        <div className="relative">
          <MarcaEstetica estetica={estetica} grande />
        </div>

        <div className="relative mt-8 lg:mt-0">
          {eLogin ? (
            <>
              <h2 className="text-3xl leading-tight font-bold lg:text-4xl">
                Bom ter você de volta.
              </h2>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/80">
                Entre para acompanhar seus agendamentos, veículos e histórico de
                serviços.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl leading-tight font-bold lg:text-4xl">
                Agende sem ligar nem esperar.
              </h2>
              <ul className="mt-5 hidden space-y-3 lg:block">
                {[
                  "Sem ligações ou retornos lentos",
                  "Receba lembretes automáticos",
                  "Pagamento via PIX ou no local",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
