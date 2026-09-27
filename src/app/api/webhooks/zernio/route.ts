import { NextResponse } from "next/server";
import { zernioGate } from "@/lib/integrations/gates";

export async function POST() {
  const gate = zernioGate();
  if (gate.status === "pending_credentials") {
    return NextResponse.json({ status: "pending_credentials", missing: gate.missing }, { status: 503 });
  }
  return NextResponse.json({ status: "accepted" });
}
