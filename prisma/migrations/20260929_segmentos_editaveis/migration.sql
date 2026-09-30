-- Segmentos editaveis por estetica (RN01 revisada, pedido da EstimaCar 20/09).
--
-- Antes: enum SegmentoVeiculo fixo no sistema (HATCH/SEDAN/SUV/PICKUP/VAN) e
-- cinco colunas de preco em "servico". O cliente real nao atende VAN e cobra
-- diferente de picape pequena e picape grande — a lista fixa sobrava e faltava
-- ao mesmo tempo.
--
-- Depois: tabela "segmento" pertencente ao tenant, e "preco_servico" ligando
-- servico x segmento.
--
-- Esta migration NAO perde dado: cada tenant existente ganha os cinco segmentos
-- de antes (podendo renomear/remover depois pela tela de Catalogo), os veiculos
-- sao reapontados pelo nome equivalente e os cinco precos viram cinco linhas.

-- ============================================================
-- 0. O RLS vale para esta migration tambem
--
-- Descoberto na primeira tentativa desta migration, em banco com dados:
-- "veiculo" e "servico" tem FORCE ROW LEVEL SECURITY, e o role da aplicacao
-- (astro) nao e superuser nem tem BYPASSRLS — de proposito, e a migration
-- 20260723_rls_multi_tenant depende disso. Entao um UPDATE/SELECT daqui
-- tambem e filtrado por current_setting('app.tenant_id'), que nao existe no
-- contexto de uma migration: o UPDATE alcancava ZERO linhas e o SET NOT NULL
-- quebrava com "contem valores nulos".
--
-- `SET row_security = off` exigiria BYPASSRLS, que o astro nao tem. O que ele
-- pode, por ser DONO das tabelas, e suspender o FORCE — sem FORCE o dono
-- passa pelas policies. Suspende aqui, restaura no passo 5.
--
-- Qualquer migration futura que MEXA EM DADOS dessas tabelas precisa fazer o
-- mesmo. As que so mexem em estrutura (DDL) nao precisam.
-- ============================================================

ALTER TABLE "veiculo" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "servico" NO FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 1. Tabela de segmentos, com os cinco de hoje para cada tenant
-- ============================================================

CREATE TABLE "segmento" (
  "id"       TEXT    NOT NULL,
  "tenantId" TEXT    NOT NULL,
  "nome"     TEXT    NOT NULL,
  "ordem"    INTEGER NOT NULL,
  "ativo"    BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "segmento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "segmento_tenantId_nome_key" ON "segmento"("tenantId", "nome");
CREATE INDEX "segmento_tenantId_idx" ON "segmento"("tenantId");

ALTER TABLE "segmento" ADD CONSTRAINT "segmento_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- gen_random_uuid() vem do pgcrypto, embutido no PostgreSQL 13+.
INSERT INTO "segmento" ("id", "tenantId", "nome", "ordem", "ativo")
SELECT gen_random_uuid()::text, t."id", nomes.nome, nomes.ordem, true
FROM "tenant" t
CROSS JOIN (VALUES
  ('Hatch', 1),
  ('Sedan', 2),
  ('SUV', 3),
  ('Pickup', 4),
  ('Van', 5)
) AS nomes(nome, ordem);

-- ============================================================
-- 2. veiculo.segmento (enum) -> veiculo.segmentoId (FK)
-- ============================================================

ALTER TABLE "veiculo" ADD COLUMN "segmentoId" TEXT;

-- O casamento e pelo nome que a migration acabou de inserir; o enum era
-- MAIUSCULO ('SUV') e o nome novo e capitalizado ('SUV', 'Pickup'), por isso
-- o upper() dos dois lados.
UPDATE "veiculo" v
SET "segmentoId" = s."id"
FROM "segmento" s
WHERE s."tenantId" = v."tenantId"
  AND upper(s."nome") = v."segmento"::text;

ALTER TABLE "veiculo" ALTER COLUMN "segmentoId" SET NOT NULL;
ALTER TABLE "veiculo" DROP COLUMN "segmento";

CREATE INDEX "veiculo_segmentoId_idx" ON "veiculo"("segmentoId");
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_segmentoId_fkey"
  FOREIGN KEY ("segmentoId") REFERENCES "segmento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 3. As cinco colunas de preco viram linhas em preco_servico
-- ============================================================

CREATE TABLE "preco_servico" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "servicoId"  TEXT NOT NULL,
  "segmentoId" TEXT NOT NULL,
  "valor"      DECIMAL(10,2) NOT NULL,
  CONSTRAINT "preco_servico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preco_servico_servicoId_segmentoId_key"
  ON "preco_servico"("servicoId", "segmentoId");
CREATE INDEX "preco_servico_tenantId_idx" ON "preco_servico"("tenantId");

ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_servicoId_fkey"
  FOREIGN KEY ("servicoId") REFERENCES "servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_segmentoId_fkey"
  FOREIGN KEY ("segmentoId") REFERENCES "segmento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "preco_servico" ("id", "tenantId", "servicoId", "segmentoId", "valor")
SELECT gen_random_uuid()::text, sv."tenantId", sv."id", sg."id",
  CASE sg."nome"
    WHEN 'Hatch'  THEN sv."precoHatch"
    WHEN 'Sedan'  THEN sv."precoSedan"
    WHEN 'SUV'    THEN sv."precoSuv"
    WHEN 'Pickup' THEN sv."precoPickup"
    WHEN 'Van'    THEN sv."precoVan"
  END
FROM "servico" sv
JOIN "segmento" sg ON sg."tenantId" = sv."tenantId";

ALTER TABLE "servico"
  DROP COLUMN "precoHatch",
  DROP COLUMN "precoSedan",
  DROP COLUMN "precoSuv",
  DROP COLUMN "precoPickup",
  DROP COLUMN "precoVan";

-- ============================================================
-- 4. RLS nas duas tabelas novas (RNF06)
--    Mesmo regime das outras: sao dados por tenant, entao entram no
--    mesmo isolamento. Sem isto, o catalogo de uma estetica seria
--    legivel pelas outras.
-- ============================================================

ALTER TABLE "segmento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segmento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "segmento"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "preco_servico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preco_servico" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "preco_servico"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- 5. Restaura o FORCE suspenso no passo 0
--
-- Sem isto o isolamento fica mais fraco do que era antes desta migration:
-- o dono das tabelas passaria a enxergar tudo. O teste rls-isolamento.test.ts
-- (nivel 0) verifica ENABLED *e* FORCED nas 8 tabelas e pegaria a falta.
-- ============================================================

ALTER TABLE "veiculo" FORCE ROW LEVEL SECURITY;
ALTER TABLE "servico" FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 6. O enum deixa de existir
-- ============================================================

DROP TYPE "SegmentoVeiculo";
