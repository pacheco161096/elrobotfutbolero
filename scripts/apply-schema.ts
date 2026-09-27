import fs from "fs";
import path from "path";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL pendiente. No se aplicó el esquema.");
    return;
  }
  const sql = fs.readFileSync(path.join(process.cwd(), "db/schema.sql"), "utf8");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Esquema aplicado.");
}

void main();
