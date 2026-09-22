import { ModalSlot } from "@/components/ui/modal-slot";
import { getTenantPorSlug } from "@/lib/tenant";

// Layout de /[slug] que existe por dois motivos: abrir o slot paralelo
// @modal, usado pelas rotas interceptadas (o cadastro de veiculo), e aplicar
// a cor de marca do tenant (RF13, UC12) via variavel CSS — vale tanto para o
// site do cliente quanto para o Admin, que compartilham os tokens astro-*.
//
// Ele nao desenha chrome. A casca visual do cliente continua sendo a
// ClienteShell, um componente que cada tela importa se quiser — login,
// cadastro e confirmado sao telas cheias, sem menu, e um layout com chrome
// aqui envolveria todas elas sem distincao.
//
// Um slug invalido nao vira 404 aqui: cada pagina ja faz sua propria checagem
// (mesmo raciocinio do admin/layout.tsx) e da o notFound() correto.
export default async function SlugLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantPorSlug(slug);
  const cor = tenant?.corPrimaria ?? "#2563eb";

  return (
    <div
      className="contents"
      style={
        {
          "--color-astro-blue": cor,
          // Declarada aqui tambem, e nao so no @theme: um var() dentro de um
          // token do tema resolve usando o valor herdado no elemento ONDE O
          // TOKEN E DEFINIDO (o :root do Tailwind), nao onde e usado — entao
          // sem isso o tom claro ficava preso no azul padrao mesmo com a cor
          // primaria trocada.
          "--color-astro-blue-bright": `color-mix(in srgb, ${cor} 80%, white 20%)`,
        } as React.CSSProperties
      }
    >
      {children}
      <ModalSlot>{modal}</ModalSlot>
    </div>
  );
}
