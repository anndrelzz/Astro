// Iniciais para o avatar do cliente: primeira letra dos dois primeiros nomes
// ("André Luiz da Silva" -> "AL"). Nome com uma palavra so vira uma letra.
// Usado no lugar de foto de perfil — o envio de foto ficou fora do escopo
// (o RFC nao preve foto de perfil).
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "U";
  if (partes.length === 1) return partes[0][0]!.toUpperCase();
  return (partes[0][0]! + partes[1][0]!).toUpperCase();
}
