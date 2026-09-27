import fs from "fs";
import path from "path";

export function GET() {
  const file = path.join(process.cwd(), "docs/bot-referencia.png");
  const body = fs.readFileSync(file);
  return new Response(body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
