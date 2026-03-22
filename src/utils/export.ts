function serializeSvg(svgElement: SVGSVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportSvg(svgElement: SVGSVGElement, filename = "chen-diagram.svg"): void {
  const svgMarkup = serializeSvg(svgElement);
  downloadBlob(new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export async function exportPng(
  svgElement: SVGSVGElement,
  width: number,
  height: number,
  filename = "chen-diagram.png",
): Promise<void> {
  const svgMarkup = serializeSvg(svgElement);
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load the diagram for PNG export."));
    image.src = url;
  });

  const scale = window.devicePixelRatio > 1 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas is not available in this browser.");
  }

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = "#f3f7f4";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  URL.revokeObjectURL(url);

  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });

  if (!pngBlob) {
    throw new Error("PNG export failed.");
  }

  downloadBlob(pngBlob, filename);
}

