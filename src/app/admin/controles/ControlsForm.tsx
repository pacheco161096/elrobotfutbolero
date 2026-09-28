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
  const [word, setWord] = useState("");
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("Estos controles se guardan en PostgreSQL. El worker los lee en el siguiente ciclo.");

  async function send(next: Overrides) {
    const response = await fetch("/api/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const body = (await response.json()) as { overrides: Overrides; durable: boolean };
    setState(body.overrides);
    setNote(body.durable ? "Guardado en PostgreSQL. El worker de Render lo lee en el siguiente ciclo." : "No se guardó. Falta DATABASE_URL.");
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
      <form className="controls" onSubmit={(event) => { event.preventDefault(); if (!word.trim()) return; void send({ ...state, blockedWords: [...state.blockedWords, word.trim()] }); setWord(""); }}>
        <input aria-label="Bloquear palabra" value={word} onChange={(event) => setWord(event.target.value)} placeholder="Bloquear palabra" />
        <button type="submit">BLOQUEAR PALABRA</button>
      </form>
      <form className="controls" onSubmit={(event) => { event.preventDefault(); if (!person.trim()) return; void send({ ...state, blockedPeople: [...state.blockedPeople, person.trim()] }); setPerson(""); }}>
        <input aria-label="Bloquear persona" value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Bloquear persona" />
        <button type="submit">BLOQUEAR PERSONA</button>
      </form>
      <p className="meta">{note}</p>
      <List label="Fuentes bloqueadas" items={state.blockedSources} onRemove={(item) => void send({ ...state, blockedSources: state.blockedSources.filter((value) => value !== item) })} />
      <List label="Temas bloqueados" items={state.blockedTopics} onRemove={(item) => void send({ ...state, blockedTopics: state.blockedTopics.filter((value) => value !== item) })} />
      <List label="Palabras bloqueadas" items={state.blockedWords} onRemove={(item) => void send({ ...state, blockedWords: state.blockedWords.filter((value) => value !== item) })} />
      <List label="Personas bloqueadas" items={state.blockedPeople} onRemove={(item) => void send({ ...state, blockedPeople: state.blockedPeople.filter((value) => value !== item) })} />
    </>
  );
}

function List({ label, items, onRemove }: { label: string; items: string[]; onRemove: (item: string) => void }) {
  return (
    <p className="meta">
      {label}: {items.length === 0 ? "ninguna" : items.map((item) => (
        <button key={item} type="button" onClick={() => onRemove(item)}>{item} ×</button>
      ))}
    </p>
  );
}
