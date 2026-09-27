import { getOverrides } from "@/lib/control/overrides";
import { ControlsForm } from "./ControlsForm";

export default function ControlesPage() {
  return (
    <>
      <h1>Controles de emergencia</h1>
      <p className="lead">Sirven para detener al BOT. No son una redacción manual.</p>
      <section className="panel section">
        <ControlsForm initial={getOverrides()} />
      </section>
    </>
  );
}
