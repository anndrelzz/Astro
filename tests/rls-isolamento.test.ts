import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { withTelegramTokenLookup, withTenant } from "@/lib/tenant-db";

// Testes de isolamento multi-tenant (RFC v1.0, M5 — "Testes de isolamento RLS").
//
// Verificam a afirmacao da secao 6.1 do RFC: "Nenhuma query retorna dados de
// outro tenant, INDEPENDENTE DA CAMADA DE APLICACAO" — por isso os casos do
// nivel 1 consultam o banco cru, sem passar por withTenant().
//
// Meta do KPI (secao 1.6): 0 vazamentos em 100% dos testes de isolamento.
//
// Requer um PostgreSQL real com as migrations aplicadas, conectado com o MESMO
// role da aplicacao (DATABASE_URL). Rodar com:
//   npm run test:rls

// As 6 tabelas com RLS. A secao 6.1 do RFC cita 5 (usuario, agendamento,
// servico, veiculo, notificacao); a implementacao cobre tambem
// horario_funcionamento, entao o teste cobre as 6.
const TABELAS_COM_RLS = [
  "usuario",
  "veiculo",
  "servico",
  "agendamento",
  "horario_funcionamento",
  "notificacao",
] as const;

const PREFIXO = "__test__rls";
const TOKEN_A = `${PREFIXO}-token-do-tenant-a`;

type Fixture = {
  tenantId: string;
  usuarioId: string;
  servicoId: string;
  veiculoId: string;
  agendamentoId: string;
  notificacaoId: string;
};

let tenantA: Fixture;
let tenantB: Fixture;

// 42501 = insufficient_privilege, o SQLSTATE que o PostgreSQL usa quando uma
// clausula WITH CHECK de policy RLS rejeita a escrita. Validamos pelo CODIGO e
// nao pelo texto: a mensagem vem traduzida conforme o locale do servidor
// ("a nova linha viola a politica de seguranca..." em pt-BR), o que tornaria o
// teste dependente da configuracao regional do banco.
function violaPolicyRls(erro: unknown) {
  const causa = (erro as { cause?: { code?: string } }).cause;
  return causa?.code === "42501";
}

async function criarTenantCompleto(sufixo: string, linkToken: string | null) {
  const tenant = await prisma.tenant.create({
    data: { nome: `Estetica de teste ${sufixo}`, slug: `${PREFIXO}-${sufixo}` },
  });

  return withTenant(tenant.id, async (tx): Promise<Fixture> => {
    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome: `Cliente ${sufixo}`,
        email: `cliente-${sufixo}@teste.local`,
        senhaHash: "$2b$10$hashfalsoparateste0000000000000000000000000000000000",
        telegramLinkToken: linkToken,
      },
    });

    const servico = await tx.servico.create({
      data: {
        tenantId: tenant.id,
        nome: `Lavagem ${sufixo}`,
        duracaoMin: 60,
        precoHatch: 60,
        precoSedan: 70,
        precoSuv: 90,
        precoPickup: 100,
        precoVan: 120,
      },
    });

    const veiculo = await tx.veiculo.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        marca: "Fiat",
        modelo: `Modelo ${sufixo}`,
        placa: sufixo === "a" ? "AAA1A11" : "BBB2B22",
        ano: 2020,
        cor: "Preto",
        segmento: "HATCH",
      },
    });

    await tx.horarioFuncionamento.create({
      data: { tenantId: tenant.id, diaSemana: 1, horaInicioMin: 480, horaFimMin: 1080 },
    });

    const agendamento = await tx.agendamento.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        veiculoId: veiculo.id,
        servicoId: servico.id,
        dataHora: new Date(2026, 11, 1, 10, 0),
        formaPagamento: "LOCAL",
        valor: 60,
      },
    });

    const notificacao = await tx.notificacao.create({
      data: {
        tenantId: tenant.id,
        agendamentoId: agendamento.id,
        tipo: "CONFIRMACAO_AGENDAMENTO",
      },
    });

    return {
      tenantId: tenant.id,
      usuarioId: usuario.id,
      servicoId: servico.id,
      veiculoId: veiculo.id,
      agendamentoId: agendamento.id,
      notificacaoId: notificacao.id,
    };
  });
}

// Limpeza na ordem das foreign keys. Escopo restrito aos ids criados aqui —
// nunca um deleteMany aberto, para nao tocar em dados de desenvolvimento.
async function removerTenantCompleto(f: Fixture | undefined) {
  if (!f) return;
  await withTenant(f.tenantId, async (tx) => {
    await tx.notificacao.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.agendamento.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.veiculo.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.horarioFuncionamento.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.usuario.deleteMany({ where: { tenantId: f.tenantId } });
    await tx.servico.deleteMany({ where: { tenantId: f.tenantId } });
  });
  await prisma.tenant.delete({ where: { id: f.tenantId } });
}

before(async () => {
  // Remove sobras de uma execucao anterior interrompida.
  const orfaos = await prisma.tenant.findMany({
    where: { slug: { startsWith: PREFIXO } },
    select: { id: true },
  });
  for (const t of orfaos) {
    await removerTenantCompleto({
      tenantId: t.id,
      usuarioId: "",
      servicoId: "",
      veiculoId: "",
      agendamentoId: "",
      notificacaoId: "",
    });
  }

  tenantA = await criarTenantCompleto("a", TOKEN_A);
  tenantB = await criarTenantCompleto("b", null);
});

after(async () => {
  await removerTenantCompleto(tenantA);
  await removerTenantCompleto(tenantB);
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// NIVEL 0 — pre-condicoes do SGBD.
// Nao verifica comportamento, e sim o AMBIENTE. Se o role de conexao tiver
// SUPERUSER ou BYPASSRLS, o Postgres ignora as policies: os niveis 1 a 4
// falhariam, mas como uma parede de erros sem causa aparente. Este nivel
// serve para (a) dar o diagnostico preciso em uma linha e (b) funcionar como
// pre-voo ao apontar o DATABASE_URL para um ambiente novo — em producao o
// role e outro, criado fora daqui, e essa e a verificacao que a migration
// 20260723182655_rls_multi_tenant pede antes de promover.
// RFC 6.1: "isolamento garantido em nivel de banco de dados".
// ---------------------------------------------------------------------------
describe("nivel 0 — pre-condicoes do banco", () => {
  test("o role da aplicacao nao burla RLS", async () => {
    const [role] = await prisma.$queryRawUnsafe<
      { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >(
      `SELECT current_user, rolsuper, rolbypassrls
         FROM pg_roles WHERE rolname = current_user`
    );

    assert.equal(role.rolsuper, false, `role "${role.current_user}" e superuser: RLS seria ignorado`);
    assert.equal(role.rolbypassrls, false, `role "${role.current_user}" tem BYPASSRLS: RLS seria ignorado`);
  });

  test("RLS esta ENABLED e FORCED nas 6 tabelas sensiveis", async () => {
    const lista = TABELAS_COM_RLS.map((t) => `'${t}'`).join(", ");
    const linhas = await prisma.$queryRawUnsafe<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname IN (${lista})`
    );

    assert.equal(linhas.length, TABELAS_COM_RLS.length, "tabela faltando no banco");
    for (const t of linhas) {
      assert.equal(t.relrowsecurity, true, `${t.relname}: RLS desligado`);
      // Sem FORCE, o DONO da tabela (que e a propria aplicacao, pois rodou as
      // migrations) pularia as policies silenciosamente.
      assert.equal(t.relforcerowsecurity, true, `${t.relname}: falta FORCE ROW LEVEL SECURITY`);
    }
  });

  test("tenant fica fora do RLS (diretorio publico consultado por slug)", async () => {
    const [t] = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean }[]>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'tenant'`
    );
    assert.equal(t.relrowsecurity, false, "tenant com RLS quebraria login/cadastro");
  });
});

// ---------------------------------------------------------------------------
// NIVEL 1 — falha fechada.
// RFC 6.1: "Nenhuma query retorna dados de outro tenant, INDEPENDENTE DA
// CAMADA DE APLICACAO". Aqui consultamos sem withTenant(), de proposito.
// ---------------------------------------------------------------------------
describe("nivel 1 — falha fechada (sem contexto de tenant)", () => {
  for (const tabela of TABELAS_COM_RLS) {
    test(`sem app.tenant_id, "${tabela}" retorna zero linhas`, async () => {
      const [{ total }] = await prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM "${tabela}"`
      );
      assert.equal(total, 0, `"${tabela}" vazou dados sem contexto de tenant`);
    });
  }

  test("o padrao e negar: os dados existem, mas so aparecem com contexto", async () => {
    const semContexto = await prisma.usuario.findMany();
    assert.equal(semContexto.length, 0, "leitura sem contexto retornou linhas");

    const comContexto = await withTenant(tenantA.tenantId, (tx) => tx.usuario.findMany());
    assert.ok(comContexto.length > 0, "os dados de teste deveriam existir");
  });
});

// ---------------------------------------------------------------------------
// NIVEL 2 — isolamento de leitura.
// RFC RN07: "Dados de um tenant jamais devem ser acessiveis por outro tenant".
// ---------------------------------------------------------------------------
describe("nivel 2 — isolamento de leitura", () => {
  test("tenant A ve os proprios usuarios e nenhum do B", async () => {
    const vistos = await withTenant(tenantA.tenantId, (tx) => tx.usuario.findMany());

    assert.ok(vistos.length > 0, "A deveria ver os proprios usuarios");
    assert.ok(
      vistos.every((u) => u.tenantId === tenantA.tenantId),
      "vazou usuario de outro tenant"
    );
  });

  test("A nao alcanca registros de B nem pedindo pelo id exato", async () => {
    const alvos = await withTenant(tenantA.tenantId, async (tx) => ({
      usuario: await tx.usuario.findUnique({ where: { id: tenantB.usuarioId } }),
      servico: await tx.servico.findUnique({ where: { id: tenantB.servicoId } }),
      veiculo: await tx.veiculo.findUnique({ where: { id: tenantB.veiculoId } }),
      agendamento: await tx.agendamento.findUnique({ where: { id: tenantB.agendamentoId } }),
      notificacao: await tx.notificacao.findUnique({ where: { id: tenantB.notificacaoId } }),
    }));

    for (const [nome, registro] of Object.entries(alvos)) {
      assert.equal(registro, null, `A leu ${nome} do tenant B pelo id`);
    }
  });

  test("o vazamento tambem nao ocorre no sentido inverso (B -> A)", async () => {
    const achado = await withTenant(tenantB.tenantId, (tx) =>
      tx.agendamento.findUnique({ where: { id: tenantA.agendamentoId } })
    );
    assert.equal(achado, null, "B leu agendamento do tenant A");
  });

  test("contagem por tabela nunca inclui linhas do vizinho", async () => {
    const contagens = await withTenant(tenantA.tenantId, async (tx) => ({
      usuario: await tx.usuario.count({ where: { tenantId: tenantB.tenantId } }),
      servico: await tx.servico.count({ where: { tenantId: tenantB.tenantId } }),
      veiculo: await tx.veiculo.count({ where: { tenantId: tenantB.tenantId } }),
      agendamento: await tx.agendamento.count({ where: { tenantId: tenantB.tenantId } }),
      notificacao: await tx.notificacao.count({ where: { tenantId: tenantB.tenantId } }),
      horario: await tx.horarioFuncionamento.count({ where: { tenantId: tenantB.tenantId } }),
    }));

    for (const [nome, total] of Object.entries(contagens)) {
      assert.equal(total, 0, `A contou ${total} linha(s) de ${nome} do tenant B`);
    }
  });

  test("join nao e rota de fuga: A nao ve agendamentos de B via include", async () => {
    const usuarios = await withTenant(tenantA.tenantId, (tx) =>
      tx.usuario.findMany({ include: { agendamentos: true, veiculos: true } })
    );

    const ids = usuarios.flatMap((u) => u.agendamentos.map((a) => a.id));
    assert.ok(
      !ids.includes(tenantB.agendamentoId),
      "agendamento de B apareceu atraves de um join"
    );
  });
});

// ---------------------------------------------------------------------------
// NIVEL 3 — isolamento de escrita (clausula WITH CHECK).
// RFC 6.1: "A coluna tenant_id ... nunca e exposta ou manipulavel pelo cliente".
// Leitura (USING) e escrita (WITH CHECK) sao clausulas distintas da policy e
// precisam de testes distintos.
// ---------------------------------------------------------------------------
describe("nivel 3 — isolamento de escrita (WITH CHECK)", () => {
  test("A nao consegue CRIAR registro carimbado com o tenantId de B", async () => {
    await assert.rejects(
      () =>
        withTenant(tenantA.tenantId, (tx) =>
          tx.servico.create({
            data: {
              tenantId: tenantB.tenantId, // tentativa de escrever no vizinho
              nome: "servico invasor",
              duracaoMin: 30,
              precoHatch: 1,
              precoSedan: 1,
              precoSuv: 1,
              precoPickup: 1,
              precoVan: 1,
            },
          })
        ),
      violaPolicyRls,
      "o banco aceitou uma escrita carimbada com outro tenant"
    );
  });

  test("A nao consegue ALTERAR registros de B", async () => {
    const resultado = await withTenant(tenantA.tenantId, (tx) =>
      tx.servico.updateMany({
        where: { tenantId: tenantB.tenantId },
        data: { nome: "alterado por A" },
      })
    );
    assert.equal(resultado.count, 0, "A alterou dados do tenant B");

    // confirma que o nome original permaneceu intacto
    const original = await withTenant(tenantB.tenantId, (tx) =>
      tx.servico.findUnique({ where: { id: tenantB.servicoId } })
    );
    assert.equal(original?.nome, "Lavagem b", "o registro de B foi modificado");
  });

  test("A nao consegue APAGAR registros de B", async () => {
    const resultado = await withTenant(tenantA.tenantId, (tx) =>
      tx.agendamento.deleteMany({ where: { tenantId: tenantB.tenantId } })
    );
    assert.equal(resultado.count, 0, "A apagou dados do tenant B");

    const aindaExiste = await withTenant(tenantB.tenantId, (tx) =>
      tx.agendamento.findUnique({ where: { id: tenantB.agendamentoId } })
    );
    assert.ok(aindaExiste, "o agendamento de B foi removido");
  });

  test("A nao consegue MIGRAR um registro proprio para o tenant B", async () => {
    await assert.rejects(
      () =>
        withTenant(tenantA.tenantId, (tx) =>
          tx.servico.update({
            where: { id: tenantA.servicoId },
            data: { tenantId: tenantB.tenantId },
          })
        ),
      violaPolicyRls,
      "foi possivel mover um registro para outro tenant"
    );
  });
});

// ---------------------------------------------------------------------------
// NIVEL 4 — a excecao deliberada do webhook do Telegram.
// RFC RN12 / UC15 / 6.3. A policy de "usuario" tem uma segunda condicao no
// USING (nunca no WITH CHECK) que permite localizar o dono de um
// telegramLinkToken sem contexto de tenant. Por ser um furo proposital no
// isolamento, precisa ser provado ESTREITO.
// ---------------------------------------------------------------------------
describe("nivel 4 — excecao do webhook do Telegram", () => {
  test("com token valido, resolve o dono sem saber o tenant de antemao", async () => {
    const usuario = await withTelegramTokenLookup(TOKEN_A, (tx) =>
      tx.usuario.findFirst({ where: { telegramLinkToken: TOKEN_A } })
    );

    assert.ok(usuario, "o webhook nao conseguiu resolver o token de vinculacao");
    assert.equal(usuario.tenantId, tenantA.tenantId);
  });

  test("a excecao expoe SO o dono do token, nunca a tabela inteira", async () => {
    const vistos = await withTelegramTokenLookup(TOKEN_A, (tx) => tx.usuario.findMany());

    assert.equal(vistos.length, 1, "a excecao virou porta aberta para a tabela usuario");
    assert.equal(vistos[0].telegramLinkToken, TOKEN_A);
  });

  test("a excecao permite LER, mas nunca ESCREVER", async () => {
    await assert.rejects(
      () =>
        withTelegramTokenLookup(TOKEN_A, (tx) =>
          tx.usuario.updateMany({
            where: { telegramLinkToken: TOKEN_A },
            data: { nome: "sequestrado" },
          })
        ),
      violaPolicyRls,
      "foi possivel escrever usando apenas o token de vinculacao"
    );
  });

  test("token inexistente nao alcanca nenhum usuario", async () => {
    const vistos = await withTelegramTokenLookup(`${PREFIXO}-token-que-nao-existe`, (tx) =>
      tx.usuario.findMany()
    );
    assert.equal(vistos.length, 0, "token invalido retornou usuarios");
  });

  test("token vazio nao abre a tabela (guarda <> '' da policy)", async () => {
    const vistos = await withTelegramTokenLookup("", (tx) => tx.usuario.findMany());
    assert.equal(vistos.length, 0, "GUC vazia liberou a tabela usuario");
  });
});
