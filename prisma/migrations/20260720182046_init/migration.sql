-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENTE');

-- CreateEnum
CREATE TYPE "SegmentoVeiculo" AS ENUM ('HATCH', 'SEDAN', 'SUV', 'PICKUP', 'VAN');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE_PAGAMENTO', 'PIX_PENDENTE', 'CONFIRMADO', 'CANCELADO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'LOCAL');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('CONFIRMACAO_AGENDAMENTO', 'LEMBRETE_24H', 'LEMBRETE_2H', 'CONFIRMACAO_CANCELAMENTO');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA');

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "corPrimaria" TEXT,
    "telefone" TEXT,
    "pixChaveCopiaCola" TEXT,
    "cancelamentoHorasLimite" INTEGER NOT NULL DEFAULT 2,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "telefone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENTE',
    "telegramChatId" TEXT,
    "telegramLinkToken" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cor" TEXT NOT NULL,
    "segmento" "SegmentoVeiculo" NOT NULL,

    CONSTRAINT "veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servico" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "precoHatch" DECIMAL(10,2) NOT NULL,
    "precoSedan" DECIMAL(10,2) NOT NULL,
    "precoSuv" DECIMAL(10,2) NOT NULL,
    "precoPickup" DECIMAL(10,2) NOT NULL,
    "precoVan" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "enviadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "usuario_tenantId_idx" ON "usuario"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tenantId_email_key" ON "usuario"("tenantId", "email");

-- CreateIndex
CREATE INDEX "veiculo_usuarioId_idx" ON "veiculo"("usuarioId");

-- CreateIndex
CREATE INDEX "servico_tenantId_idx" ON "servico"("tenantId");

-- CreateIndex
CREATE INDEX "agendamento_tenantId_idx" ON "agendamento"("tenantId");

-- CreateIndex
CREATE INDEX "agendamento_tenantId_dataHora_idx" ON "agendamento"("tenantId", "dataHora");

-- CreateIndex
CREATE INDEX "notificacao_agendamentoId_idx" ON "notificacao"("agendamentoId");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servico" ADD CONSTRAINT "servico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
