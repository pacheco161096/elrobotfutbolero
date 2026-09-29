import { runSpeech } from "@/lib/integrations/speech-collect";
import { authorizeCron } from "@/lib/http/cron";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const blocked = authorizeCron(request, ["database"]);
  if (blocked) return blocked;
  const result = await runSpeech(process.env, new Date(), fetch, "start");
  const http = result.status === "error" ? 502 : result.status === "pending_credentials" ? 503 : 200;
  return NextResponse.json(result, { status: http });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
