"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const principal = {
  href: "/liga-mx",
  kicker: "Liga MX",
  title: "La jornada entra a la edición cuando el dato ya está confirmado.",
  image: "/referencia",
};

const noticias = [
  { href: "/seleccion", kicker: "Selección", title: "El Tri se publica si la nota está verificada.", image: "/referencia" },
  { href: "/femenil", kicker: "Femenil", title: "La Liga MX Femenil lleva el mismo rasero.", image: "/referencia" },
  { href: "/mas-deportes", kicker: "Más deportes", title: "Lo demás espera su turno en la portada.", image: "/referencia" },
  { href: "/jornada", kicker: "Jornada", title: "La jornada del día se arma con lo que ya está confirmado.", image: "/referencia" },
  { href: "/resultados", kicker: "Resultados", title: "Los resultados aparecen cuando el marcador está cerrado.", image: "/referencia" },
  { href: "/equipos", kicker: "Equipos", title: "Cada club entra a la edición por lo que hizo, no por el escudo.", image: "/referencia" },
  { href: "/noticias", kicker: "Noticias", title: "La nota sale si aporta algo. Si no, se queda en la mesa.", image: "/referencia" },
];

function paginasDe(cantidad: number, porPagina: number) {
  return Array.from({ length: Math.ceil(cantidad / porPagina) }, (_, pagina) =>
    noticias.slice(pagina * porPagina, pagina * porPagina + porPagina),
  );
}

export function PortadaInteractiva() {
  const [porPagina, setPorPagina] = useState(3);
  const [pagina, setPagina] = useState(0);
  const [pausado, setPausado] = useState(false);
  const paginas = paginasDe(noticias.length, porPagina);

  useEffect(() => {
    const medir = () => setPorPagina(window.innerWidth <= 720 ? 1 : 3);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    setPagina((actual) => Math.min(actual, Math.max(paginas.length - 1, 0)));
  }, [paginas.length]);

  useEffect(() => {
    if (pausado || paginas.length < 2) return;
    const id = window.setInterval(() => {
      setPagina((actual) => (actual + 1) % paginas.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [pausado, paginas.length]);

  function ir(siguiente: number) {
    setPagina((actual) => Math.min(Math.max(siguiente, 0), paginas.length - 1));
  }

  return (
    <>
      <section className="hero" style={{ backgroundImage: `url(${principal.image})` }}>
        <div className="hero-copy">
          <p className="kicker">{principal.kicker}</p>
          <h1>{principal.title}</h1>
          <Link className="leer-mas" href={principal.href}>Leer más</Link>
        </div>
      </section>
      <section
        className="slider"
        aria-label="Noticias"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
      >
        <div className="slider-viewport">
          <div className="slider-track" style={{ transform: `translateX(-${pagina * 100}%)` }}>
            {paginas.map((grupo, indice) => (
              <div className="slider-page" key={indice}>
                {grupo.map((item) => (
                  <Link key={item.href} className="note" href={item.href}>
                    <img src={item.image} alt="" />
                    <p>{item.kicker}</p>
                    <h2>{item.title}</h2>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="slider-dots" role="tablist" aria-label="Páginas del slider">
          {paginas.map((_, indice) => (
            <button
              key={indice}
              type="button"
              className={indice === pagina ? "dot on" : "dot"}
              aria-label={`Página ${indice + 1}`}
              onClick={() => ir(indice)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
