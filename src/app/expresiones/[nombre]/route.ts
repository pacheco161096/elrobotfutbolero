import fs from "fs";
import path from "path";
import { expressionFile } from "@/lib/engines/copy";

export function GET(_request: Request, context: { params: Promise<{ nombre: string }> }) {
  return context.params.then(({ nombre }) => {
    const relative = expressionFile(nombre);
    if (!relative) return new Response("No existe esa expresión.", { status: 404 });
    const file = path.join(process.cwd(), relative);
    if (!fs.existsSync(file)) return new Response("No existe esa expresión.", { status: 404 });
    return new Response(fs.readFileSync(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  });
}
