import { pendingItems } from "@/lib/config/pending";
import { sampleRuns } from "@/lib/demo/samples";

export default function HomePage() {
  const items = pendingItems();
  const runs = sampleRuns();
  return (
    <>
      <h1>Qué está haciendo el BOT</h1>
      <p className="lead">
        Los motores ya deciden y arman un borrador con el dato fijo. OpenAI, Facebook y el sondeo en vivo siguen apagados hasta que pases cada credencial. No hace falta mandarlas ahora.
      </p>
      <section className="panel section">
        <h2>Pendiente</h2>
        {items.map((item) => (
          <div className="pending" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.detail}</span>
            </div>
            <em className={item.ready ? "badge ready" : "badge wait"}>{item.ready ? "LISTO" : "PENDIENTE"}</em>
          </div>
        ))}
      </section>
      <section className="section">
        <h2>Simulación editorial</h2>
        <p className="meta">No se publica ni se guarda. Sirve para ver por qué saldría o no saldría un post.</p>
        <div className="grid">
          {runs.map(({ title, result }) => (
            <article className="card" key={title}>
              <h2>{title}</h2>
              <p><em className={result.publication.status === "pending_credentials" ? "badge wait" : result.decision === "DISCARD" ? "badge stop" : "badge go"}>{result.decision}</em></p>
              <p>{result.reason}</p>
              {result.draft ? <p className="lines">{result.draft.text}</p> : result.flash?.lockedLines.length ? <p className="lines">{result.flash.lockedLines.join("\n")}</p> : null}
              {result.draft ? <p className="meta">Esta simulación sigue en plantilla. En un evento real, OpenAI reescribe solo la personalidad. El marcador queda en las líneas fijas.</p> : null}
              <p className="meta">Publicación: {result.publication.status}{result.publication.missing.length ? ` · ${result.publication.missing.join(", ")}` : ""}</p>
              <p className="meta">Veracidad: {result.truth} · Importancia: {result.importance} · Voz: {result.checks.voz}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
