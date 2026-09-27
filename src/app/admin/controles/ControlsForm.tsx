"use client";

import { useState } from "react";
import type { Overrides } from "@/lib/control/overrides";

const flags: Array<[keyof Overrides, string]> = [
  ["pauseAll", "PAUSAR TODO"],
  ["pausePublishing", "PAUSAR PUBLICACIONES"],
  ["pauseLive", "PAUSAR LIVE"],
  ["pauseImages", "PAUSAR IMÁGENES"],
  ["pauseContext", "PAUSAR CONTEXT ENGINE"],
  ["safeMode", "SAFE MODE"],
];

export function ControlsForm({ initial }: { initial: Overrides }) {
  const [state, setState] = useState(initial);
  const [source, setSource] = useState("");
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("Sin PostgreSQL, estos controles viven en este proceso y se reinician con el servidor.");

  async function send(next: Overrides) {
    const response = await fetch("/api/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const body = (await response.json()) as { overrides: Overrides; durable: boolean };
    setState(body.overrides);
    setNote(body.durable ? "Guardado en PostgreSQL." : "Aplicado en este proceso. La persistencia espera DATABASE_URL.");
  }

  return (
    <>
      <div className="controls">
        {flags.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => void send({ ...state, [key]: !state[key] })}
          >
            {label}: {state[key] ? "ACTIVO" : "apagado"}
          </button>
        ))}
      </div>
      <form className="controls section" onSubmit={(event) => { event.preventDefault(); if (!source.trim()) return; void send({ ...state, blockedSources: [...state.blockedSources, source.trim()] }); setSource(""); }}>
        <input aria-label="Bloquear fuente" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Bloquear fuente" />
        <button type="submit">BLOQUEAR FUENTE</button>
      </form>
      <form className="controls" onSubmit={(event) => { event.preventDefault(); if (!topic.trim()) return; void send({ ...state, blockedTopics: [...state.blockedTopics, topic.trim()] }); setTopic(""); }}>
        <input aria-label="Bloquear tema" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Bloquear tema" />
        <button type="submit">BLOQUEAR TEMA</button>
      </form>
      <p className="meta">{note}</p>
      <p className="meta">Fuentes bloqueadas: {state.blockedSources.join(", ") || "ninguna"}</p>
      <p className="meta">Temas bloqueados: {state.blockedTopics.join(", ") || "ninguno"}</p>
    </>
  );
}
