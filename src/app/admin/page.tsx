import { pendingItems } from "@/lib/config/pending";
import { sampleRuns } from "@/lib/demo/samples";
import { readAiSpend } from "@/lib/integrations/ai-cost";

export const dynamic = "force-dynamic";

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(value);
}

function when(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(new Date(value));
}

export default async function HomePage() {
  const items = pendingItems();
  const runs = sampleRuns();
  const spend = await readAiSpend();
  return (
    <>
      <h1>Qué está haciendo el BOT</h1>
      <p className="lead">
        Credenciales, gasto estimado de OpenAI y una simulación que no se publica. El costo es una estimación con la tarifa pública del modelo, no la factura.
      </p>
      <section className="panel section">
        <h2>Costo de IA</h2>
        {spend ? (
          <>
            <div className="pending">
              <div>
                <strong>Hoy</strong>
                <span>{spend.todayPromptTokens} tokens de entrada · {spend.todayCompletionTokens} de salida</span>
              </div>
              <em className="badge ready">{money(spend.todayUsd)}</em>
            </div>
            <div className="pending">
              <div>
                <strong>Acumulado</strong>
                <span>{spend.promptTokens} tokens de entrada · {spend.completionTokens} de salida{spend.unpriced ? ` · ${spend.unpriced} sin tarifa` : ""}</span>
              </div>
              <em className="badge">{money(spend.totalUsd)}</em>
            </div>
            {spend.recent.length ? (
              <table className="rows">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Área</th>
                    <th>Modelo</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>USD</th>
                  </tr>
                </thead>
                <tbody>
                  {spend.recent.map((row) => (
                    <tr key={`${row.at}-${row.area}-${row.model}`}>
                      <td>{when(row.at)}</td>
                      <td>{row.area}</td>
                      <td>{row.model}</td>
                      <td>{row.promptTokens}</td>
                      <td>{row.completionTokens}</td>
                      <td>{row.usd == null ? "sin tarifa" : money(row.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="meta">Todavía no hay llamadas guardadas.</p>}
          </>
        ) : <p className="meta">El gasto aparece cuando hay base de datos y la tabla de uso.</p>}
      </section>
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
