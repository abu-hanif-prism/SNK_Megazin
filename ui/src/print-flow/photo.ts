// Decodes an uploaded photo, honors EXIF orientation, and downscales it once
// to a working size. Everything downstream (preview + compositor) uses this
// downscaled bitmap — old phones never touch the raw 12MP image again.
export interface ProcessedPhoto {
  canvas: HTMLCanvasElement; // downscaled, orientation-corrected pixels
  previewUrl: string; // object URL of the same pixels for <img>
  width: number;
  height: number;
}

const MAX_WORKING_PX = 2400; // ~2x the print's long edge — plenty for 300 DPI

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const source = await decode(file);
  const scale = Math.min(1, MAX_WORKING_PX / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) (source as ImageBitmap).close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92)
  );
  return { canvas, previewUrl: URL.createObjectURL(blob), width, height };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // some older WebViews reject the options bag — fall through
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // revoke later: the img element keeps its own reference once decoded —
    // but Safari needs the URL alive while drawing, so revoke on idle
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
