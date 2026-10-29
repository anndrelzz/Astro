import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { foiRecebido, janela, lerPeriodo, totalCobrado } from "@/lib/financeiro";
import { FUSO, chaveDia } from "@/lib/fuso";
import { withTenant } from "@/lib/tenant-db";

// RF12, objetivo 5 do RFC — relatorio financeiro exportavel. Um CSV com os
// agendamentos do periodo (sem os cancelados), o mesmo recorte da tela.
//
// Formato pensado para o Excel em portugues: separador ";", virgula decimal e
// BOM no inicio (sem ele o Excel abre os acentos quebrados).

const SITUACAO: Record<string, string> = {
  PENDENTE_PAGAMENTO: "A receber no local",
  PIX_PENDENTE: "PIX pendente",
  CONFIRMADO: "Pago",
  CONCLUIDO: "Pago",
};

// Celula de CSV: aspas quando precisa e, contra injecao de formula na
// planilha, um apostrofo antes de texto que comece com = + - @.
function celula(v: string) {
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const reais = (v: number) => v.toFixed(2).replace(".", ",");

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const periodo = lerPeriodo(new URL(request.url).searchParams.get("periodo"));
  const { inicio, fim } = janela(periodo);
  const tenantId = session.user.tenantId;

  const agendamentos = await withTenant(tenantId, (tx) =>
    tx.agendamento.findMany({
      where: { tenantId, status: { not: "CANCELADO" }, dataHora: { gte: inicio, lte: fim } },
      include: { usuario: true, servico: true },
      orderBy: { dataHora: "asc" },
    })
  );

  const linhas = [
    ["Data", "Hora", "Cliente", "Serviço", "Forma de pagamento", "Situação", "Valor", "Acréscimo", "Total", "Recebido"],
    ...agendamentos.map((a) => [
      a.dataHora.toLocaleDateString("pt-BR", { timeZone: FUSO }),
      a.dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }),
      a.usuario.nome,
      a.servico.nome,
      a.formaPagamento === "PIX" ? "PIX" : "No local",
      SITUACAO[a.status] ?? a.status,
      reais(Number(a.valor)),
      reais(Number(a.acrescimoAplicado ?? 0)),
      reais(totalCobrado(a)),
      foiRecebido(a.status) ? "Sim" : "Não",
    ]),
  ];

  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  const nome = `financeiro-${chaveDia(inicio)}-a-${chaveDia(fim)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
