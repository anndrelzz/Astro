import Link from "next/link";

export function AdminNav({ slug }: { slug: string }) {
  const links = [
    { href: `/${slug}/admin/agendamentos`, label: "Agendamentos" },
    { href: `/${slug}/admin/servicos`, label: "Servicos" },
    { href: `/${slug}/admin/configuracoes`, label: "Configuracoes" },
  ];

  return (
    <nav className="mb-6 flex gap-4 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
