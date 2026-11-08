// Cria uma estetica nova com o Admin dela e os tipos de veiculo iniciais, tudo
// numa transacao: se um passo falhar, nada fica pela metade. Usada pelo
// autocadastro (POST /api/esteticas) e pelo script do terminal
// (prisma/criar-tenant.ts).
//
// Sem `import "server-only"` e com imports relativos de proposito: o script
// do terminal roda fora do Next.js, onde aquele pacote derruba o processo.
// Nada daqui chega ao navegador — so a rota e o script importam.

import { Prisma, type PrismaClient } from "../generated/prisma/client";

// Ponto de partida dos tipos de veiculo (RN01 revisada; decisao do Andre,
// 06/11). Sem nenhum, o Catalogo ficaria vazio e o Admin nao conseguiria
// cadastrar servico, porque o preco depende do tipo. Ele renomeia, remove e
// acrescenta no primeiro acesso. Van ficou de fora: a EstimaCar mostrou que
// quase ninguem atende.
export const SEGMENTOS_INICIAIS = ["Hatch", "Sedan", "SUV", "Utilitário"] as const;

export type NovaEstetica = {
  nomeEstetica: string;
  /** Ja normalizado e conferido (compartilhado/endereco-estetica.ts). */
  slug: string;
  nomeAdmin: string;
  email: string;
  senhaHash: string;
  /** So digitos. Vira o WhatsApp do site e o telefone do Admin. */
  whatsapp?: string;
  cadastroIpHash?: string;
};

/** O endereco ja e de outra estetica (inclusive quando duas pessoas pedem o mesmo ao mesmo tempo). */
export class EnderecoEmUso extends Error {
  constructor() {
    super("Endereco ja usado por outra estetica");
    this.name = "EnderecoEmUso";
  }
}

export async function criarEstetica(banco: Pick<PrismaClient, "$transaction">, dados: NovaEstetica) {
  try {
    return await banco.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nome: dados.nomeEstetica,
          slug: dados.slug,
          whatsapp: dados.whatsapp,
          cadastroIpHash: dados.cadastroIpHash,
        },
      });

      // A tabela tenant nao tem RLS, mas usuario e segmento tem: as escritas
      // abaixo precisam do app.tenant_id da estetica nova. SET LOCAL (true):
      // vale so dentro desta transacao, como no withTenant.
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenant.id);

      const admin = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome: dados.nomeAdmin,
          email: dados.email,
          telefone: dados.whatsapp,
          senhaHash: dados.senhaHash,
          role: "ADMIN",
        },
      });

      await tx.segmento.createMany({
        data: SEGMENTOS_INICIAIS.map((nome, ordem) => ({ tenantId: tenant.id, nome, ordem })),
      });

      return { tenant, admin };
    });
  } catch (erro) {
    // O unico campo unico do tenant e o slug; o e-mail do Admin e unico so
    // dentro da estetica, que acabou de nascer vazia.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new EnderecoEmUso();
    }
    throw erro;
  }
}
