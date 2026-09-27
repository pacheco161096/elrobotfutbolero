import Link from "next/link";
import type { ReactNode } from "react";

const menu = [
  ["/jornada", "Jornada"],
  ["/resultados", "Resultados"],
  ["/equipos", "Equipos"],
  ["/noticias", "Noticias"],
];

export function Periodico({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <header className="topbar">
        <Link className="logo" href="/">El Robot Futbolero</Link>
        <nav className="menu" aria-label="Secciones">
          {menu.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
