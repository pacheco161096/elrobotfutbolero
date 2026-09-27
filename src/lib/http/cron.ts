import { NextResponse } from "next/server";
import { missingNames, readCredentials, type Credentials } from "@/lib/config/pending";

type Env = Record<string, string | undefined>;

export function authorizeCron(
  request: Request,
  needs: Array<keyof Credentials> = ["database", "apiFootball"],
  env: Env = process.env,
): NextResponse | null {
  const credentials = readCredentials(env);
  if (!credentials.cron) {
    return NextResponse.json({ status: "pending_credentials", missing: ["CRON_SECRET"] }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  const missing = missingNames(credentials, needs.filter((key) => key === "database" || key === "apiFootball"));
  if (missing.length) {
    return NextResponse.json({ status: "pending_credentials", missing }, { status: 503 });
  }
  return null;
}
