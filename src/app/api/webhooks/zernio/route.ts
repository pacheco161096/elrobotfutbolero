import { NextResponse } from "next/server";
import { zernioGate } from "@/lib/integrations/gates";
import { learnFromWebhook } from "@/lib/integrations/learn";

export async function POST(request: Request) {
  const gate = zernioGate();
  if (gate.status === "pending_credentials") {
    return NextResponse.json({ status: "pending_credentials", missing: gate.missing }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const learned = await learnFromWebhook(body);
  return NextResponse.json({ status: "accepted", updated: learned.updated });
}
