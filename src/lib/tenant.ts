import { cache } from "react";
import { prisma } from "@/lib/prisma";

// [slug]/layout.tsx e admin/layout.tsx (que roda dentro dele em toda pagina
// do Admin) buscavam o tenant pelo mesmo slug em duas queries separadas no
// mesmo request. cache() do React memoiza por chamada de renderizacao,
// entao os dois layouts passam a compartilhar a mesma busca.
export const getTenantPorSlug = cache((slug: string) =>
  prisma.tenant.findUnique({ where: { slug } })
);
