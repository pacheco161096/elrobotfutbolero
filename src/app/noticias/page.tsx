import { Periodico } from "@/components/Periodico";
import { listNotes } from "@/lib/db/stories";

export const dynamic = "force-dynamic";

export default async function Page() {
  const notes = await listNotes();
  return (
    <Periodico>
      <article className="section-page">
        <p className="kicker">Noticias</p>
        <h2>Noticias</h2>
        <p>Lo que ya pasó por la mesa de redacción. Si el dato no está cerrado, no aparece aquí.</p>
        {notes.length === 0 ? (
          <div className="empty-board">
            <strong>Edición vacía</strong>
            <span>Todavía no hay notas guardadas.</span>
          </div>
        ) : (
          <ul className="fixtures">
            {notes.map((note) => (
              <li className="fixture" key={note.id}>
                <div>
                  <strong>{note.title}</strong>
                  {note.body ? <p className="lines">{note.body}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </Periodico>
  );
}
