// request.json() lanca excecao se o corpo nao for JSON valido. Sem isso,
// qualquer corpo malformado (vazio, texto solto, etc.) derruba a rota com
// 500 em vez de responder 400.
export async function lerJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
