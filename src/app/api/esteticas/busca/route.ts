import { NextResponse } from "next/server";
import { prisma } from "@/back/prisma";
import { MAX_RESULTADOS_BUSCA, MIN_LETRAS_BUSCA, termoDaBusca } from "@/compartilhado/busca-estetica";

// Busca publica da estetica pelo nome, para o "Entrar" da landing: o dono
// digita parte do nome e escolhe a estetica dele, que leva ao login dela.
// Publica de proposito (quem ainda nao entrou nao tem sessao), entao devolve
// so o que ja aparece na tela de login de qualquer estetica: nome, endereco
// (slug) e logo. A tabela tenant nao tem RLS; os dados das esteticas, sim.
//
// Acento e maiuscula nao importam: o termo chega sem acento (termoDaBusca) e o
// nome perde o acento no proprio banco (translate), sem extensao no Postgres.

type Resultado = { nome: string; slug: string; logoUrl: string | null };

export async function GET(request: Request) {
  const termo = termoDaBusca(new URL(request.url).searchParams.get("q"));
  if (termo === null) {
    return NextResponse.json({ error: `Digite pelo menos ${MIN_LETRAS_BUSCA} letras do nome.` }, { status: 400 });
  }

  // Parametro do $queryRaw: o termo nunca vira parte do SQL.
  const esteticas = await prisma.$queryRaw<Resultado[]>`
    SELECT nome, slug, "logoUrl"
    FROM tenant
    WHERE translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
      LIKE '%' || ${termo} || '%' ESCAPE '\\'
    ORDER BY nome
    LIMIT ${MAX_RESULTADOS_BUSCA}
  `;

  return NextResponse.json({ esteticas });
}
