import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { dispararNotificacao } from "@/lib/notificacoes";
import { enviarEmail } from "@/lib/notificacoes/email";
import { enviarTelegram } from "@/lib/notificacoes/telegram";

// Fluxo de notificacoes (secao 3.4 do RFC): registra a notificacao, monta o
// texto, envia o e-mail sempre (RN13) e o Telegram so para quem vinculou, e
// marca o resultado. O envio em si e substituido por funcoes falsas.

vi.mock("@/lib/notificacoes/email", () => ({ enviarEmail: vi.fn() }));
vi.mock("@/lib/notificacoes/telegram", () => ({ enviarTelegram: vi.fn() }));

const email = vi.mocked(enviarEmail);
const telegram = vi.mocked(enviarTelegram);

// 29/10/2026 as 10:00 de Brasilia.
const DATA_HORA = new Date("2026-10-29T13:00:00Z");

function bancoFalso(telegramChatId: string | null, existe = true) {
  const criadas: unknown[] = [];
  const atualizadas: unknown[] = [];
  const tx = {
    agendamento: {
      findUnique: async () =>
        existe
          ? {
              id: "ag-1",
              tenantId: "tenant-1",
              dataHora: DATA_HORA,
              usuario: { email: "cliente@teste.com", telegramChatId },
              servico: { nome: "Lavagem completa" },
            }
          : null,
    },
    notificacao: {
      create: async (args: unknown) => {
        criadas.push(args);
        return { id: "not-1" };
      },
      update: async (args: unknown) => {
        atualizadas.push(args);
        return {};
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, criadas, atualizadas };
}

beforeEach(() => {
  email.mockReset().mockResolvedValue({ enviado: true, modo: "log" });
  telegram.mockReset().mockResolvedValue({ enviado: true, modo: "log" });
});

describe("dispararNotificacao", () => {
  test("agendamento que nao existe nao gera notificacao nem envio", async () => {
    const { tx, criadas } = bancoFalso(null, false);
    await dispararNotificacao(tx, "ag-x", "CONFIRMACAO_AGENDAMENTO");
    expect(criadas).toHaveLength(0);
    expect(email).not.toHaveBeenCalled();
  });

  test("registra a notificacao como pendente antes de enviar", async () => {
    const { tx, criadas } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");
    expect(criadas[0]).toEqual({
      data: {
        tenantId: "tenant-1",
        agendamentoId: "ag-1",
        tipo: "CONFIRMACAO_AGENDAMENTO",
        status: "PENDENTE",
      },
    });
  });

  test("e-mail de confirmacao traz o servico e a data no horario de Brasilia", async () => {
    const { tx } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");

    const [destinatario, assunto, texto] = email.mock.calls[0];
    expect(destinatario).toBe("cliente@teste.com");
    expect(assunto).toBe("Agendamento confirmado");
    expect(texto).toContain("Lavagem completa");
    expect(texto).toContain("29/10/2026");
    expect(texto).toContain("10:00");
  });

  test.each([
    ["LEMBRETE_24H", "Lembrete: seu agendamento e amanha", "amanha"],
    ["LEMBRETE_2H", "Lembrete: seu agendamento e em 2 horas", "em 2 horas"],
    ["CONFIRMACAO_CANCELAMENTO", "Agendamento cancelado", "foi cancelado"],
  ] as const)("%s tem assunto e texto proprios", async (tipo, assunto, trecho) => {
    const { tx } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", tipo);
    expect(email.mock.calls[0][1]).toBe(assunto);
    expect(email.mock.calls[0][2]).toContain(trecho);
  });

  test("sem Telegram vinculado, envia so o e-mail", async () => {
    const { tx } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");
    expect(email).toHaveBeenCalledTimes(1);
    expect(telegram).not.toHaveBeenCalled();
  });

  test("com Telegram vinculado, envia tambem para o chat do cliente", async () => {
    const { tx } = bancoFalso("chat-42");
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");
    expect(telegram).toHaveBeenCalledWith("chat-42", email.mock.calls[0][2]);
  });

  test("e-mail enviado marca a notificacao como ENVIADA, com a data", async () => {
    const { tx, atualizadas } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");
    expect(atualizadas[0]).toMatchObject({
      where: { id: "not-1" },
      data: { status: "ENVIADA", enviadoEm: expect.any(Date), tentativas: { increment: 1 } },
    });
  });

  test("e-mail que falhou marca a notificacao como FALHA, sem data de envio", async () => {
    email.mockResolvedValue({ enviado: false, modo: "resend", erro: "falhou" });
    const { tx, atualizadas } = bancoFalso(null);
    await dispararNotificacao(tx, "ag-1", "CONFIRMACAO_AGENDAMENTO");
    expect(atualizadas[0]).toMatchObject({
      data: { status: "FALHA", enviadoEm: null, tentativas: { increment: 1 } },
    });
  });
});
