// Estado padrao do slot @modal: nada. Sem este arquivo, o slot nao teria o que
// renderizar nas rotas que não são interceptadas, e o Next reclamaria.
export default function Default() {
  return null;
}
