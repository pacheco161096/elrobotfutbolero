import fs from "fs";
import path from "path";
import { parse, type Font, type PathCommand } from "opentype.js";
import sharp from "sharp";
import type { CardGoal } from "@/lib/engines/score-card";

const W = 1080;
const H = 1350;
const GREEN = "#c6f135";
const INK = "#f4f7ea";
const VEIL = "#070b08";

let cached: Font | null = null;

function fontFile(): string {
  const din = ["docs/fonts/DINCondensed-Bold.otf", "docs/fonts/DINCondensed-Bold.ttf"]
    .map((file) => path.join(process.cwd(), file))
    .find((file) => fs.existsSync(file));
  return din ?? path.join(process.cwd(), "assets/fonts/BarlowCondensed-Bold.ttf");
}

function cardFont(): Font {
  if (!cached) cached = parse(fs.readFileSync(fontFile()));
  return cached;
}

function num(value: number | undefined): string {
  return Number.isFinite(value) ? (Math.round((value as number) * 100) / 100).toString() : "0";
}

function commandData(command: PathCommand): string {
  if (command.type === "M") return `M${num(command.x)} ${num(command.y)}`;
  if (command.type === "L") return `L${num(command.x)} ${num(command.y)}`;
  if (command.type === "Q") return `Q${num(command.x1)} ${num(command.y1)} ${num(command.x)} ${num(command.y)}`;
  if (command.type === "C") return `C${num(command.x1)} ${num(command.y1)} ${num(command.x2)} ${num(command.y2)} ${num(command.x)} ${num(command.y)}`;
  if (command.type === "Z") return "Z";
  return "";
}

function place(text: string, size: number, tracking = 0): { d: string; width: number } {
  const font = cardFont();
  const scale = size / font.unitsPerEm;
  let cursor = 0;
  let d = "";
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    d += glyph.getPath(cursor, 0, size).commands.map(commandData).join("");
    cursor += glyph.advanceWidth * scale + tracking;
  }
  return { d, width: text ? cursor - tracking : 0 };
}

function text(d: string, x: number, baseline: number, fill: string): string {
  return `<g transform="translate(${x} ${baseline})" filter="url(#sh)"><path d="${d}" fill="${fill}"/></g>`;
}

function ball(cx: number, cy: number): string {
  return `<g transform="translate(${cx} ${cy})" filter="url(#sh)"><circle r="11" fill="${INK}"/><circle r="3" fill="${VEIL}"/></g>`;
}

async function framedMark(buffer: Buffer, kind: "bandera" | "escudo"): Promise<Buffer> {
  const fitted = kind === "bandera"
    ? sharp(buffer).resize(112, 74, { fit: "cover", position: "centre" })
    : sharp(buffer).resize(96, 64, { fit: "contain", background: VEIL }).extend({
        top: 5,
        bottom: 5,
        left: 8,
        right: 8,
        background: VEIL,
      });
  const png = await fitted.png().toBuffer();
  const mask = Buffer.from(
    `<svg width="112" height="74" xmlns="http://www.w3.org/2000/svg"><rect width="112" height="74" rx="8" ry="8" fill="#fff"/></svg>`,
  );
  return sharp(png).resize(112, 74).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function goalRows(goals: CardGoal[], side: "home" | "away"): string {
  const parts: string[] = [];
  goals.forEach((goal, index) => {
    const baseline = 1134 - (goals.length - 1 - index) * 58;
    const minute = place(`${goal.minute}'`, 40);
    const name = place(goal.name, 40);
    if (side === "home") {
      parts.push(ball(60, baseline - 26));
      parts.push(text(minute.d, 84, baseline, GREEN));
      parts.push(text(name.d, 156, baseline, INK));
      return;
    }
    const minuteRight = 994;
    const widest = Math.max(...goals.map((item) => place(`${item.minute}'`, 40).width));
    const nameRight = minuteRight - widest - 14;
    parts.push(ball(1020, baseline - 26));
    parts.push(text(minute.d, minuteRight - minute.width, baseline, GREEN));
    parts.push(text(name.d, nameRight - name.width, baseline, INK));
  });
  return parts.join("");
}

function scoreGroup(input: { homeCode: string; awayCode: string; homeScore: number; awayScore: number }): { svg: string; homeX: number; awayX: number } {
  const homeCode = place(input.homeCode, 36, 1.5);
  const awayCode = place(input.awayCode, 36, 1.5);
  const homeScore = place(String(input.homeScore), 118);
  const awayScore = place(String(input.awayScore), 118);
  const width = 112 + 20 + homeCode.width + 26 + homeScore.width + 20 + 28 + 20 + awayScore.width + 26 + awayCode.width + 20 + 112;
  let x = (W - width) / 2;
  const homeX = x;
  x += 112 + 20;
  const codeHome = text(homeCode.d, x, 1254, INK);
  x += homeCode.width + 26;
  const scoreHome = text(homeScore.d, x, 1282, INK);
  x += homeScore.width + 20;
  const bar = `<rect x="${x}" y="1237" width="28" height="8" rx="2" fill="${GREEN}"/>`;
  x += 28 + 20;
  const scoreAway = text(awayScore.d, x, 1282, INK);
  x += awayScore.width + 26;
  const codeAway = text(awayCode.d, x, 1254, INK);
  x += awayCode.width + 20;
  const awayX = x;
  return { svg: `${codeHome}${scoreHome}${bar}${scoreAway}${codeAway}`, homeX, awayX };
}

export async function renderScoreCard(input: {
  photo: Buffer;
  homeMark: Buffer;
  awayMark: Buffer;
  homeMarkKind: "bandera" | "escudo";
  awayMarkKind: "bandera" | "escudo";
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
  homeGoals: CardGoal[];
  awayGoals: CardGoal[];
}): Promise<Buffer> {
  const photo = await sharp(input.photo).resize(W, H, { fit: "cover", position: "centre" }).modulate({ brightness: 0.92, saturation: 1.05 }).png().toBuffer();
  const homeFlag = await framedMark(input.homeMark, input.homeMarkKind);
  const awayFlag = await framedMark(input.awayMark, input.awayMarkKind);
  const bot = await sharp(path.join(process.cwd(), "docs/bot-cuerpo.png"))
    .extract({ left: 168, top: 148, width: 528, height: 390 })
    .resize(136, 136, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const botFace = await sharp(bot)
    .composite([{
      input: Buffer.from(`<svg width="136" height="136" xmlns="http://www.w3.org/2000/svg"><rect width="136" height="136" rx="26" ry="26" fill="#fff"/></svg>`),
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
  const score = scoreGroup(input);
  const defs = `<defs>
      <linearGradient id="bottom" x1="0" y1="860" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${VEIL}" stop-opacity="0"/>
        <stop offset="0.35" stop-color="${VEIL}" stop-opacity="0.20"/>
        <stop offset="1" stop-color="${VEIL}" stop-opacity="0.84"/>
      </linearGradient>
      <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${VEIL}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${VEIL}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="right" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stop-color="${VEIL}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${VEIL}" stop-opacity="0"/>
      </linearGradient>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.2" flood-color="#000" flood-opacity="0.9"/>
      </filter>
    </defs>`;
  const board = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${defs}
    <rect x="0" y="860" width="${W}" height="490" fill="url(#bottom)"/>
    <rect x="0" y="900" width="560" height="280" fill="url(#left)"/>
    <rect x="720" y="1040" width="360" height="150" fill="url(#right)"/>
    ${goalRows(input.homeGoals, "home")}
    ${goalRows(input.awayGoals, "away")}
    ${score.svg}
  </svg>`);
  const rings = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${score.homeX}" y="1204" width="112" height="74" rx="8" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
    <rect x="${score.awayX}" y="1204" width="112" height="74" rx="8" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
    <rect x="908" y="36" width="136" height="136" rx="26" fill="none" stroke="${GREEN}" stroke-width="3"/>
  </svg>`);
  return sharp(photo)
    .composite([
      { input: board, top: 0, left: 0 },
      { input: homeFlag, top: 1204, left: Math.round(score.homeX) },
      { input: awayFlag, top: 1204, left: Math.round(score.awayX) },
      { input: botFace, top: 36, left: 908 },
      { input: rings, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
