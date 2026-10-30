// Tipo real de uma imagem enviada, lido dos primeiros bytes do arquivo.
//
// O `type` de um File vem do navegador, que o deduz pela extensao — quem monta
// a requisicao na mao escreve ali o que quiser. Os primeiros bytes ("numero
// magico") sao parte do proprio arquivo: um HTML renomeado para .png continua
// comecando com "<html", nao com a assinatura do PNG.
//
// So os tres formatos aceitos para o logo. SVG fica de fora de proposito (ver
// rota de upload do logo).
export function tipoDaImagem(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const comeca = (assinatura: number[], deslocamento = 0) =>
    assinatura.every((b, i) => bytes[deslocamento + i] === b);

  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  // WEBP: "RIFF", 4 bytes de tamanho, "WEBP".
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
