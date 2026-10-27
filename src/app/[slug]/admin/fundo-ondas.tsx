// Fundo com ondas de luz na cor da estetica (--color-astro-blue), para as telas
// com cards em vidro (.vidro). Feito so com CSS, sem imagem: muda junto com a
// cor escolhida na Identidade visual (RF13) e nao pesa no carregamento.
//
// Fica fixo na tela (o conteudo rola por cima, que e o que faz o vidro
// parecer vidro) e atras de tudo: -z-10 dentro do layout do Admin, que tem
// `isolate` para que a camada negativa fique acima do fundo preto dele e
// abaixo da sidebar e do conteudo.
export function FundoOndas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Brilho no alto, a direita */}
      <div className="absolute -top-[30vh] -right-[10vw] h-[80vh] w-[60vw] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-astro-blue)_70%,transparent),transparent)] blur-2xl" />

      {/* Onda principal: um circulo enorme cuja borda atravessa a tela na
          diagonal. A faixa larga e desfocada da o volume; o fio nitido logo
          dentro dela e o brilho da quina, como nas referencias. */}
      <div className="absolute top-[22vh] left-[34vw] h-[170vh] w-[170vh] rounded-full bg-[radial-gradient(circle,transparent_56%,color-mix(in_srgb,var(--color-astro-blue)_85%,transparent)_64%,color-mix(in_srgb,var(--color-astro-blue)_35%,transparent)_69%,transparent_72%)] blur-xl" />
      <div className="absolute top-[calc(22vh+11.5vh)] left-[calc(34vw+11.5vh)] h-[147vh] w-[147vh] rounded-full border-2 border-astro-blue-bright/80 blur-[2px]" />

      {/* Segunda onda, no canto de baixo a esquerda */}
      <div className="absolute -bottom-[95vh] -left-[40vh] h-[140vh] w-[140vh] rounded-full bg-[radial-gradient(circle,transparent_58%,color-mix(in_srgb,var(--color-astro-blue)_55%,transparent)_66%,transparent_71%)] blur-2xl" />

      {/* Escurece de leve o lado esquerdo, onde comecam os textos */}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,0,0,0.45),transparent_55%)]" />
    </div>
  );
}
