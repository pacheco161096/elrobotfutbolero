const MIN_BYTES = 5_000;
const MAX_BYTES = 4_000_000;

function isImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return jpeg || png || webp;
}

export async function downloadImage(url: string, fetchImpl: typeof fetch): Promise<Uint8Array | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !/^image\/(jpeg|jpg|png|webp)/i.test(type)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < MIN_BYTES || bytes.byteLength > MAX_BYTES || !isImage(bytes)) return null;
    return bytes;
  } catch {
    return null;
  }
}

export async function readImageTexts(images: Uint8Array[]): Promise<string[]> {
  if (!images.length) return [];
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { cachePath: "/tmp/tesseract-spa" });
  try {
    const texts: string[] = [];
    for (const image of images) {
      const result = await worker.recognize(Buffer.from(image));
      texts.push(result.data.text ?? "");
    }
    return texts;
  } finally {
    await worker.terminate();
  }
}
