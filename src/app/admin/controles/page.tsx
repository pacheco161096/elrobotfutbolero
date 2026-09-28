import { refreshOverrides } from "@/lib/control/overrides";
import { ControlsForm } from "./ControlsForm";

export const dynamic = "force-dynamic";

export default async function ControlesPage() {
  const overrides = await refreshOverrides(process.env.DATABASE_URL);
  return (
    <>
      <h1>Controles de emergencia</h1>
      <p className="lead">Sirven para detener al BOT. No son una redacción manual. Quedan guardados y el worker los obedece en el siguiente ciclo.</p>
      <section className="panel section">
        <ControlsForm initial={overrides} />
      </section>
    </>
  );
}
