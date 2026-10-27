// Fundo com ondas suaves na cor da estetica (--color-astro-blue), para as telas
// com cards em vidro (.vidro). Sao faixas largas e desfocadas que ondulam de
// uma ponta a outra da tela, com pouca opacidade: o preto continua sendo o
// fundo, e as ondas so dao profundidade ao vidro. Feito em SVG, sem imagem:
// muda junto com a cor escolhida na Identidade visual (RF13).
//
// Fica fixo na tela (o conteudo rola por cima, que e o que faz o vidro
// parecer vidro) e atras de tudo: -z-10 dentro do layout do Admin, que tem
// `isolate` para que a camada negativa fique acima do fundo preto dele e
// abaixo da sidebar e do conteudo.

// Cada onda e uma faixa entre duas curvas que atravessam a tela inteira.
const ONDAS = [
  {
    d: "M-200,250 C200,90 620,430 1040,250 C1240,165 1380,195 1640,150 L1640,330 C1380,375 1240,325 1040,405 C620,575 200,270 -200,420 Z",
    opacidade: 0.75,
  },
  {
    d: "M-200,560 C180,440 560,700 940,560 C1180,470 1360,525 1640,470 L1640,610 C1360,660 1180,595 940,700 C560,840 180,600 -200,700 Z",
    opacidade: 0.6,
  },
  {
    d: "M-200,860 C240,740 660,930 1080,800 C1290,735 1440,770 1640,740 L1640,1000 L-200,1000 Z",
    opacidade: 0.5,
  },
];

export function FundoOndas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          {/* A cor some nas pontas e e mais forte no meio de cada faixa. */}
          <linearGradient id="onda-cor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--color-astro-blue)", stopOpacity: 0.15 }} />
            <stop offset="45%" style={{ stopColor: "var(--color-astro-blue)", stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: "var(--color-astro-blue)", stopOpacity: 0.25 }} />
          </linearGradient>
          <filter id="onda-desfoque" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>

        <g filter="url(#onda-desfoque)">
          {ONDAS.map((onda) => (
            <path key={onda.d} d={onda.d} fill="url(#onda-cor)" opacity={onda.opacidade} />
          ))}
        </g>
      </svg>
    </div>
  );
}
