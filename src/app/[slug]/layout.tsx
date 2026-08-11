// Layout de /[slug] que existe por um motivo so: abrir o slot paralelo
// @modal, usado pelas rotas interceptadas (o cadastro de veiculo).
//
// Ele nao desenha nada. A casca visual do cliente continua sendo a
// ClienteShell, um componente que cada tela importa se quiser — login,
// cadastro e confirmado sao telas cheias, sem menu, e um layout com chrome
// aqui envolveria todas elas sem distincao.
export default function SlugLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
