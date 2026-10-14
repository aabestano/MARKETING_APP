export interface TrimBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Content is anything that is not transparent and not near-white. Returns null when there is nothing to crop. */
export function trimBounds(pixels: Uint8ClampedArray, width: number, height: number, white = 245): TrimBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3];
      if (alpha < 16) continue;
      if (pixels[i] >= white && pixels[i + 1] >= white && pixels[i + 2] >= white) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  if (box.w >= width - 2 && box.h >= height - 2) return null;
  return box;
}

const nearWhite = (pixels: Uint8ClampedArray, index: number, white: number) =>
  pixels[index] >= white && pixels[index + 1] >= white && pixels[index + 2] >= white;

/**
 * Turns near-white pixels that touch the edge, and pixels that are already transparent, into transparency.
 * White that is enclosed by other colors stays. The source array is updated in place.
 */
export function clearEdgeWhite(pixels: Uint8ClampedArray, width: number, height: number, white = 245): void {
  if (width < 1 || height < 1) return;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const consider = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (seen[pixel]) return;
    const index = pixel * 4;
    const clearable = pixels[index + 3] < 16 || nearWhite(pixels, index, white);
    if (!clearable) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };
  for (let x = 0; x < width; x++) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    consider(0, y);
    consider(width - 1, y);
  }
  while (stack.length) {
    const pixel = stack.pop()!;
    pixels[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = (pixel - x) / width;
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }
}

/** Makes an edge-connected white or empty background transparent. Returns the original URL when the picture cannot be read. */
export async function removeBackgroundUrl(src: string): Promise<string> {
  if (typeof document === "undefined") return src;
  try {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (!canvas.width || !canvas.height) return src;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return src;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    clearEdgeWhite(data.data, canvas.width, canvas.height);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
}

/** Crops transparent and near-white margins. Returns the original URL when the picture cannot be read or needs no crop. */
export async function trimIllustrationUrl(src: string): Promise<string> {
  if (typeof document === "undefined") return src;
  try {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (!canvas.width || !canvas.height) return src;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return src;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const box = trimBounds(data.data, canvas.width, canvas.height);
    if (!box) return src;
    const cropped = document.createElement("canvas");
    cropped.width = box.w;
    cropped.height = box.h;
    const out = cropped.getContext("2d");
    if (!out) return src;
    out.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return cropped.toDataURL("image/png");
  } catch {
    return src;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}
