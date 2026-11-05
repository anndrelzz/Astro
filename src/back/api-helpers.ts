import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

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

// 400 com a mensagem do schema e o campo dela, para a tela mostrar o erro
// embaixo do campo certo. So "Dados invalidos" deixava o cliente sem saber o
// que corrigir. O Zod confere os campos na ordem do schema, entao o primeiro
// problema e o do primeiro campo errado do formulario.
export function respostaDadosInvalidos(erro: ZodError) {
  const primeiro = erro.issues[0];
  const campo = primeiro?.path[0];
  return NextResponse.json(
    {
      error: primeiro?.message ?? "Dados invalidos",
      campo: typeof campo === "string" ? campo : undefined,
      detalhes: erro.flatten(),
    },
    { status: 400 }
  );
}
