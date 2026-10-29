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
          grande ? "h-11 w-11 rounded-xl lg:h-14 lg:w-14 lg:rounded-2xl" : "h-9 w-9 rounded-lg"
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
            className={`font-semibold tracking-wide text-white ${grande ? "text-sm lg:text-base" : "text-xs"}`}
          >
            {iniciais}
          </span>
        )}
      </div>
      <span
        className={`truncate font-semibold text-white ${grande ? "text-base lg:text-lg" : "text-sm"}`}
      >
        {estetica.nome}
      </span>
    </div>
  );
}

// Painel de marca das telas de login e cadastro: o lado colorido do cartao,
// na cor da estetica (RF13), com o mesmo degrade e os mesmos aneis do cartao
// de faturamento do painel. A borda que encosta no formulario e uma curva
// (.painel-auth, em globals.css). No celular vira a faixa do topo do cartao,
// baixa o bastante para login e cadastro caberem na tela sem rolar: sem o
// texto de apoio e, no cadastro de celular baixo, so com o logo e o nome.
export function PainelMarca({
  modo,
  estetica,
}: {
  modo: "login" | "cadastro";
  estetica: Estetica;
}) {
  const eLogin = modo === "login";

  return (
    <aside className="relative lg:absolute lg:inset-y-0 lg:left-0 lg:w-[56%]">
      <div
        className={`painel-auth relative h-full overflow-hidden rounded-t-[1.75rem] px-5 lg:rounded-none lg:rounded-l-[2rem] text-white ${eLogin ? "pt-5 pb-12" : "pt-4 pb-8 [@media(min-height:720px)]:pt-5 [@media(min-height:720px)]:pb-12"} lg:flex lg:flex-col lg:justify-between lg:p-10 lg:pr-[14%]`}
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 100% 0%, var(--color-astro-blue-bright) 0%, var(--color-astro-blue) 40%, color-mix(in srgb, var(--color-astro-blue) 55%, black) 100%)",
        }}
      >
        {/* Aneis decorativos */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full border border-white/20 shadow-[0_0_0_44px_rgba(255,255,255,0.04),0_0_0_100px_rgba(255,255,255,0.03)]"
        />

        <div className="relative">
          <MarcaEstetica estetica={estetica} grande />
        </div>

        <div
          className={`relative mt-4 lg:mt-0 ${eLogin ? "" : "hidden lg:block [@media(min-height:720px)]:block"}`}
        >
          {eLogin ? (
            <>
              <h2 className="text-2xl leading-tight font-bold lg:text-4xl">
                Bom ter você de volta.
              </h2>
              <p className="mt-3 hidden max-w-xs text-sm leading-relaxed text-white/80 lg:block">
                Entre para acompanhar seus agendamentos, veículos e histórico de
                serviços.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl leading-tight font-bold lg:text-4xl">
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

      {/* Os cantos arredondados se repetem nas camadas de dentro porque o
          Safari nao recorta filho com mascara pelo arredondado do cartao. */}
      {/* Sombra preta sobre o azul, ao longo da curva: o lado escuro do
          formulario parece uma folha por cima do azul. E o recorte inverso
          da curva, na cor do cartao, com a sombra projetada para o lado do
          azul (o filtro fica no elemento de fora, a mascara no de dentro). */}
      <div aria-hidden className="painel-auth-sombra pointer-events-none absolute inset-0">
        <div className="painel-auth-inverso h-full w-full rounded-t-[1.75rem] bg-[#0b0b0f] lg:rounded-none lg:rounded-l-[2rem]" />
      </div>
    </aside>
  );
}
