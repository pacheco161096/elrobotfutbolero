import { NextResponse } from "next/server";
import { pendingItems } from "@/lib/config/pending";

export function GET() {
  const items = pendingItems();
  return NextResponse.json({
    bot: "El Robot Futbolero",
    engines: "listos",
    pending: items.filter((item) => !item.ready).map((item) => item.name),
  });
}
