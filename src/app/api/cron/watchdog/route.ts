import { runWatchdog } from "@/lib/cron/run";
import { authorizeCron } from "@/lib/http/cron";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const blocked = authorizeCron(request, ["database"]);
  if (blocked) return blocked;
  const result = await runWatchdog();
  return NextResponse.json(
    { status: result.error ? "error" : "ok", findings: result.findings, error: result.error },
    { status: result.error ? 502 : 200 },
  );
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
