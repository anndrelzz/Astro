-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "capacidadeSimultanea" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "intervaloMinutos" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "horario_funcionamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicioMin" INTEGER NOT NULL,
    "horaFimMin" INTEGER NOT NULL,

    CONSTRAINT "horario_funcionamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horario_funcionamento_tenantId_diaSemana_key" ON "horario_funcionamento"("tenantId", "diaSemana");

-- AddForeignKey
ALTER TABLE "horario_funcionamento" ADD CONSTRAINT "horario_funcionamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
