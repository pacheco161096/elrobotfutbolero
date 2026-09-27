import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/admin", "Tablero"],
  ["/admin/partidos", "Partidos"],
  ["/admin/stories", "Stories"],
  ["/admin/eventos", "Eventos"],
  ["/admin/jobs", "Jobs"],
  ["/admin/controles", "Controles"],
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="admin">
      <header className="top">
        <a className="brand" href="/admin">
          <img src="/referencia" alt="Cara de El Robot Futbolero" width={48} height={48} />
          <span>
            <strong>El Robot Futbolero</strong>
            <small>ENGINE POST INFLUENCER</small>
          </span>
        </a>
        <nav>
          {links.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <Link href="/">Portada</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
