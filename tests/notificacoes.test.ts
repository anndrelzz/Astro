import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { enviarNotificacoes, registrarNotificacao } from "@/lib/notificacoes";
import { enviarEmail } from "@/lib/notificacoes/email";
import { enviarTelegram } from "@/lib/notificacoes/telegram";

// Fluxo de notificacoes (secao 3.4 do RFC): registra uma linha por canal
// dentro da transacao do chamador e envia depois do commit, gravando ENVIADA
// ou FALHA em cada uma. O banco e o envio sao substituidos por objetos falsos;
// o reenvio pelo cron tem teste proprio, com banco de verdade
// (notificacao-fora-da-transacao.test.ts).

const { notificacoesNoBanco, atualizacoes } = vi.hoisted(() => ({
  notificacoesNoBanco: new Map<string, unknown>(),
  atualizacoes: [] as { where: { id: string }; data: Record<string, unknown> }[],
}));

vi.mock("@/lib/notificacoes/email", () => ({ enviarEmail: vi.fn() }));
vi.mock("@/lib/notificacoes/telegram", () => ({ enviarTelegram: vi.fn() }));
vi.mock("@/lib/tenant-db", () => ({
  withTenant: async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      notificacao: {
        findUnique: async ({ where }: { where: { id: string } }) => notificacoesNoBanco.get(where.id) ?? null,
        update: async (args: (typeof atualizacoes)[number]) => {
          atualizacoes.push(args);
          return {};
        },
      },
    }),
}));

const email = vi.mocked(enviarEmail);
const telegram = vi.mocked(enviarTelegram);

// 29/10/2026 as 10:00 de Brasilia.
const DATA_HORA = new Date("2026-10-29T13:00:00Z");

// Notificacao gravada, do jeito que o envio a le do banco.
function noBanco(
  id: string,
  canal: "EMAIL" | "TELEGRAM",
  tipo = "CONFIRMACAO_AGENDAMENTO",
  telegramChatId: string | null = "chat-42"
) {
  notificacoesNoBanco.set(id, {
    id,
    canal,
    tipo,
    agendamento: {
      dataHora: DATA_HORA,
      usuario: { email: "cliente@teste.com", telegramChatId },
      servico: { nome: "Lavagem completa" },
    },
  });
  return { tenantId: "tenant-1", notificacaoId: id };
}

const statusGravado = (id: string) => atualizacoes.find((a) => a.where.id === id)?.data;

beforeEach(() => {
  notificacoesNoBanco.clear();
  atualizacoes.length = 0;
  email.mockReset().mockResolvedValue({ enviado: true, modo: "log" });
  telegram.mockReset().mockResolvedValue({ enviado: true, modo: "log" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registrarNotificacao", () => {
  function transacaoFalsa(telegramChatId: string | null, existe = true) {
    const criadas: { data: Record<string, unknown> }[] = [];
    const tx = {
      agendamento: {
        findUnique: async () => (existe ? { tenantId: "tenant-1", usuario: { telegramChatId } } : null),
      },
      notificacao: {
        create: async (args: { data: Record<string, unknown> }) => {
          criadas.push(args);
          return { id: `not-${criadas.length}` };
        },
      },
    } as unknown as Prisma.TransactionClient;
    return { tx, criadas };
  }

  test("sem Telegram vinculado, registra so o e-mail", async () => {
    const { tx, criadas } = transacaoFalsa(null);
    const pendentes = await registrarNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");

    expect(pendentes).toEqual([{ tenantId: "tenant-1", notificacaoId: "not-1" }]);
    expect(criadas[0].data).toEqual({
      tenantId: "tenant-1",
      agendamentoId: "ag-1",
      tipo: "CONFIRMACAO_AGENDAMENTO",
      canal: "EMAIL",
      status: "PENDENTE",
    });
  });

  test("com Telegram vinculado, registra uma linha para cada canal", async () => {
    const { tx, criadas } = transacaoFalsa("chat-42");
    const pendentes = await registrarNotificacao(tx, "ag-1", "LEMBRETE_24H");

    expect(pendentes).toHaveLength(2);
    expect(criadas.map((c) => c.data.canal)).toEqual(["EMAIL", "TELEGRAM"]);
  });

  test("agendamento que nao existe nao registra nada", async () => {
    const { tx, criadas } = transacaoFalsa(null, false);
    expect(await registrarNotificacao(tx, "ag-x", "CONFIRMACAO_AGENDAMENTO")).toEqual([]);
    expect(criadas).toHaveLength(0);
  });
});

describe("enviarNotificacoes", () => {
  test("e-mail de confirmacao traz o servico e a data no horario de Brasilia", async () => {
    await enviarNotificacoes([noBanco("n1", "EMAIL")]);

    const [destinatario, assunto, texto] = email.mock.calls[0];
    expect(destinatario).toBe("cliente@teste.com");
    expect(assunto).toBe("Agendamento confirmado");
    expect(texto).toContain("Lavagem completa");
    expect(texto).toContain("29/10/2026");
    expect(texto).toContain("10:00");
    expect(telegram).not.toHaveBeenCalled();
  });

  test.each([
    ["LEMBRETE_24H", "Lembrete: seu agendamento e amanha", "amanha"],
    ["LEMBRETE_2H", "Lembrete: seu agendamento e em 2 horas", "em 2 horas"],
    ["CONFIRMACAO_CANCELAMENTO", "Agendamento cancelado", "foi cancelado"],
  ])("%s tem assunto e texto proprios", async (tipo, assunto, trecho) => {
    await enviarNotificacoes([noBanco("n1", "EMAIL", tipo)]);
    expect(email.mock.calls[0][1]).toBe(assunto);
    expect(email.mock.calls[0][2]).toContain(trecho);
  });

  test("a linha do Telegram vai para o chat do cliente, com o mesmo texto", async () => {
    await enviarNotificacoes([noBanco("n1", "EMAIL"), noBanco("n2", "TELEGRAM")]);
    expect(telegram).toHaveBeenCalledWith("chat-42", email.mock.calls[0][2]);
  });

  test("envio que deu certo grava ENVIADA, com a data, e conta a tentativa", async () => {
    await enviarNotificacoes([noBanco("n1", "EMAIL")]);
    expect(statusGravado("n1")).toEqual({
      status: "ENVIADA",
      enviadoEm: expect.any(Date),
      tentativas: { increment: 1 },
    });
  });

  test("Telegram que responde enviado: false grava FALHA, sem afetar o e-mail", async () => {
    telegram.mockResolvedValue({ enviado: false, modo: "bot", erro: "chat not found" });
    await enviarNotificacoes([noBanco("n1", "EMAIL"), noBanco("n2", "TELEGRAM")]);

    expect(statusGravado("n1")).toMatchObject({ status: "ENVIADA" });
    expect(statusGravado("n2")).toMatchObject({ status: "FALHA", enviadoEm: null });
  });

  test("erro lancado pelo envio vira FALHA e nao derruba quem chamou", async () => {
    email.mockRejectedValue(new Error("rede fora do ar"));
    await expect(enviarNotificacoes([noBanco("n1", "EMAIL")])).resolves.toBeUndefined();
    expect(statusGravado("n1")).toMatchObject({ status: "FALHA", tentativas: { increment: 1 } });
  });

  test("Telegram desvinculado depois do registro grava FALHA sem tentar enviar", async () => {
    await enviarNotificacoes([noBanco("n2", "TELEGRAM", "LEMBRETE_2H", null)]);
    expect(telegram).not.toHaveBeenCalled();
    expect(statusGravado("n2")).toMatchObject({ status: "FALHA" });
  });

  test("notificacao que sumiu do banco e ignorada", async () => {
    await enviarNotificacoes([{ tenantId: "tenant-1", notificacaoId: "nao-existe" }]);
    expect(email).not.toHaveBeenCalled();
    expect(atualizacoes).toHaveLength(0);
  });
});
