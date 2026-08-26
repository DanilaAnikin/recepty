"use client";

import { putImage } from "./storage";

/**
 * Zpracování fotek receptů.
 *
 * Oproti původní verzi se fotka neukládá jako base64 data URL, ale jako `Blob`
 * do IndexedDB. Base64 je zhruba o třetinu větší a musela se protáhnout přes
 * `JSON.stringify` při každém zápisu stavu.
 *
 * Kódování: preferuje se WebP (výrazně menší při stejné kvalitě), s fallbackem
 * na JPEG tam, kde ho `canvas.toBlob` neumí.
 */

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

export type ProcessedImage = {
  blob: Blob;
  width: number;
  height: number;
  type: string;
};

/**
 * Načte soubor do bitmapy. `createImageBitmap` je preferované — samo respektuje
 * EXIF orientaci, takže fotky z telefonu nekončí otočené na bok.
 */
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Starší Safari `imageOrientation` nezná — zkusíme to bez něj.
      try {
        return await createImageBitmap(file);
      } catch {
        // Propadneme na <img> níž.
      }
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Obrázek se nepodařilo dekódovat."));
      image.src = objectUrl;
    });
  } finally {
    // Bitmapa/element si data drží samy, URL už není potřeba.
    URL.revokeObjectURL(objectUrl);
  }
}

function imageDimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ("naturalWidth" in source) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  return { width: source.width, height: source.height };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Zmenší fotku tak, aby delší hrana byla nejvýš `maxEdge`, a zakóduje ji.
 * Menší fotky se nezvětšují. Když cokoli selže, vrátí se původní soubor —
 * uložení fotky nesmí spadnout jen kvůli nepodařené kompresi.
 */
export async function processImageFile(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY,
): Promise<ProcessedImage> {
  try {
    const source = await decodeImage(file);
    const { width, height } = imageDimensions(source);

    if (width === 0 || height === 0) {
      throw new Error("Neplatné rozměry obrázku.");
    }

    const longestEdge = Math.max(width, height);
    const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context není dostupný.");
    }
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    if ("close" in source && typeof source.close === "function") {
      source.close();
    }

    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.type === "image/webp") {
      return { blob: webp, width: targetWidth, height: targetHeight, type: webp.type };
    }

    const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
    if (jpeg) {
      return { blob: jpeg, width: targetWidth, height: targetHeight, type: jpeg.type };
    }

    throw new Error("Nepodařilo se zakódovat obrázek.");
  } catch (error) {
    console.error("Recepty Terinky: komprese obrázku selhala, ukládám originál", error);
    return { blob: file, width: 0, height: 0, type: file.type || "image/jpeg" };
  }
}

/** Zpracuje fotku a uloží ji do IndexedDB. Vrací klíč pro `recipe.imageKeys`. */
export async function storeRecipeImage(file: File): Promise<string> {
  const processed = await processImageFile(file);
  return putImage(processed.blob);
}

/**
 * Převede starou data URL na `Blob`.
 * Používá se při migraci receptů, které mají fotku ještě v `imagePath`.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) {
    return null;
  }
  const [, mimeType, base64Flag, payload] = match;

  try {
    if (base64Flag) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  } catch (error) {
    console.error("Recepty Terinky: převod data URL na Blob selhal", error);
    return null;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} kB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
