// Client-side print compositor. Renders the EXACT preview composition at
// print resolution (2480x3508 / 3508x2480 = 300 DPI on A4) on the guest's
// device — this replaces the server-side Puppeteer pipeline entirely.
//
// WYSIWYG contract: the preview shows the photo contain-fitted into the frame
// window and then transformed (translate/scale/rotate) about the window
// center. We redo the identical drawing scaled by K = printWidth/previewWidth,
// so the printed sheet is the preview's pixels, not an approximation of them.
import { asset } from "@/core/config";
import { Effect, EFFECT_FILTERS, Orientation, PhotoTransform } from "@/core/models";

export const PRINT_SIZE: Record<Orientation, { width: number; height: number }> = {
  vertical: { width: 2480, height: 3508 },
  horizontal: { width: 3508, height: 2480 },
};

const WINDOW_BACKGROUND = "#c5c5c5"; // same as legacy .image-frame background

let filterSupport: boolean | null = null;

export async function compose(options: {
  photo: HTMLCanvasElement;
  frameUrl: string; // full-res frame path (server-relative)
  orientation: Orientation;
  transform: PhotoTransform;
  effect: Effect;
  previewWidth: number; // rendered width of the preview window in CSS px
}): Promise<Blob> {
  const { photo, orientation, transform, effect, previewWidth } = options;
  const { width, height } = PRINT_SIZE[orientation];
  const k = width / previewWidth;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = WINDOW_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  // photo: contain-fit base size, then user transform about the center
  const fit = Math.min(width / photo.width, height / photo.height);
  const drawW = photo.width * fit;
  const drawH = photo.height * fit;

  ctx.save();
  const filter = EFFECT_FILTERS[effect];
  const nativeFilter = filter !== "none" && supportsCanvasFilter();
  if (nativeFilter) ctx.filter = filter;
  ctx.translate(width / 2 + transform.x * k, height / 2 + transform.y * k);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(photo, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  if (filter !== "none" && !nativeFilter) {
    applyEffectFallback(ctx, width, height, effect);
  }

  // frame overlay (transparent window PNG covering the whole sheet)
  const frame = await loadImage(asset(options.frameUrl));
  ctx.drawImage(frame, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("print render failed"))),
      "image/jpeg",
      0.92
    )
  );
}

/** Older Safari/WebViews silently ignore ctx.filter — probe with a pixel. */
function supportsCanvasFilter(): boolean {
  if (filterSupport !== null) return filterSupport;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.filter = "grayscale(100%)";
  ctx.fillStyle = "#f00";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g] = ctx.getImageData(0, 0, 1, 1).data;
  filterSupport = Math.abs(r - g) < 8;
  return filterSupport;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // dev serves frames cross-origin (3000→8080)
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

// --- pixel fallback for devices without ctx.filter --------------------------
// Reproduces the CSS filter chains via color matrices (same math the browser
// uses per the Filter Effects spec), applied to the already-drawn photo.
function applyEffectFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: Effect
) {
  let m = identity();
  if (effect === "grayscale") {
    m = grayscaleMatrix(0.9);
  } else if (effect === "warm") {
    // sepia(0.3) brightness(1.1) saturate(1.2) hue-rotate(-10deg)
    m = multiply(hueRotateMatrix(-10), multiply(saturateMatrix(1.2), multiply(brightnessMatrix(1.1), sepiaMatrix(0.3))));
  }
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = clamp255(m[0] * r + m[1] * g + m[2] * b);
    d[i + 1] = clamp255(m[5] * r + m[6] * g + m[7] * b);
    d[i + 2] = clamp255(m[10] * r + m[11] * g + m[12] * b);
  }
  ctx.putImageData(image, 0, 0);
}

type Mat = number[]; // 5x4 row-major color matrix (alpha row omitted from math)

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const identity = (): Mat => [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];

function multiply(a: Mat, b: Mat): Mat {
  const out = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[row * 5 + k] * b[k * 5 + col];
      if (col === 4) v += a[row * 5 + 4];
      out[row * 5 + col] = v;
    }
  }
  return out;
}

const sepiaMatrix = (a: number): Mat => {
  const t = 1 - a;
  return [
    0.393 + 0.607 * t, 0.769 - 0.769 * t, 0.189 - 0.189 * t, 0, 0,
    0.349 - 0.349 * t, 0.686 + 0.314 * t, 0.168 - 0.168 * t, 0, 0,
    0.272 - 0.272 * t, 0.534 - 0.534 * t, 0.131 + 0.869 * t, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

const grayscaleMatrix = (a: number): Mat => {
  const t = 1 - a;
  return [
    0.2126 + 0.7874 * t, 0.7152 - 0.7152 * t, 0.0722 - 0.0722 * t, 0, 0,
    0.2126 - 0.2126 * t, 0.7152 + 0.2848 * t, 0.0722 - 0.0722 * t, 0, 0,
    0.2126 - 0.2126 * t, 0.7152 - 0.7152 * t, 0.0722 + 0.9278 * t, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

const saturateMatrix = (s: number): Mat => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
  0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
  0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
  0, 0, 0, 1, 0,
];

const brightnessMatrix = (b: number): Mat => [
  b, 0, 0, 0, 0,
  0, b, 0, 0, 0,
  0, 0, b, 0, 0,
  0, 0, 0, 1, 0,
];

function hueRotateMatrix(deg: number): Mat {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}
