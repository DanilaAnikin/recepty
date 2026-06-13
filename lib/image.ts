"use client";

/**
 * Načte soubor jako data URL přes FileReader.readAsDataURL.
 * Interní helper — používá ho compressImageFile jako fallback.
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nepodařilo se načíst obrázek."));
    };
    reader.onerror = () => reject(new Error("Nepodařilo se načíst obrázek."));
    reader.readAsDataURL(file);
  });
}

/**
 * Zmenší obrázek na canvasu tak, aby delší hrana byla <= maxEdge (menší obrázky
 * se nezvětšují), zachová poměr stran a vrátí JPEG data URL. Při jakékoli chybě
 * (onerror, výjimka, není-li to rastrový obrázek) udělá fallback na původní
 * data URL přes FileReader, takže upload nikdy neselže.
 *
 * Pozn.: stará uložená data URL obrázků se touto cestou neprohánějí, takže se
 * nepřekomprimovávají — komprese se týká jen nově vybraných souborů.
 */
export async function compressImageFile(
  file: File,
  maxEdge = 1280,
  quality = 0.8,
): Promise<string> {
  // Nejprve načteme původní data URL — slouží jako vstup pro <img> i fallback.
  const originalDataUrl = await fileToDataUrl(file);

  try {
    const compressed = await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const width = image.naturalWidth || image.width;
          const height = image.naturalHeight || image.height;
          if (width === 0 || height === 0) {
            reject(new Error("Neplatné rozměry obrázku."));
            return;
          }

          const longestEdge = Math.max(width, height);
          // Menší obrázky nezvětšujeme — scale je nejvýše 1.
          const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
          const targetWidth = Math.round(width * scale);
          const targetHeight = Math.round(height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Canvas context není dostupný."));
            return;
          }

          context.drawImage(image, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/jpeg")) {
            resolve(dataUrl);
            return;
          }
          reject(new Error("Nepodařilo se zakódovat obrázek."));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Obrázek se nepodařilo dekódovat."));
      image.src = originalDataUrl;
    });

    return compressed;
  } catch (error) {
    console.error("Recepty Terinky: komprese obrázku selhala, použiji originál", error);
    return originalDataUrl;
  }
}
