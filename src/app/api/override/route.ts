import { NextResponse } from "next/server";
import { getOverrides, setOverrides, type Overrides } from "@/lib/control/overrides";

export function GET() {
  return NextResponse.json({ overrides: getOverrides(), durable: Boolean(process.env.DATABASE_URL) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Overrides;
  const overrides = setOverrides({
    pauseAll: Boolean(body.pauseAll),
    pausePublishing: Boolean(body.pausePublishing),
    pauseLive: Boolean(body.pauseLive),
    pauseImages: Boolean(body.pauseImages),
    pauseContext: Boolean(body.pauseContext),
    safeMode: Boolean(body.safeMode),
    blockedSources: Array.isArray(body.blockedSources) ? body.blockedSources.map(String) : [],
    blockedTopics: Array.isArray(body.blockedTopics) ? body.blockedTopics.map(String) : [],
  });
  return NextResponse.json({ overrides, durable: false });
}
