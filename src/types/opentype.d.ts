declare module "opentype.js" {
  export type PathCommand = {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  export type GlyphPath = { commands: PathCommand[] };
  export type Glyph = {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): GlyphPath;
  };
  export type Font = {
    unitsPerEm: number;
    charToGlyph(char: string): Glyph;
  };
  export function parse(buffer: Buffer | ArrayBuffer): Font;
}
