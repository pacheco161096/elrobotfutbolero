import { NextResponse } from "next/server";
import { getOverrides, persistOverrides, refreshOverrides, type Overrides } from "@/lib/control/overrides";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const overrides = databaseUrl ? await refreshOverrides(databaseUrl) : getOverrides();
  return NextResponse.json({ overrides, durable: Boolean(databaseUrl) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Overrides>;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ overrides: getOverrides(), durable: false }, { status: 503 });
  }
  const overrides = await persistOverrides(databaseUrl, body);
  return NextResponse.json({ overrides, durable: true });
}
