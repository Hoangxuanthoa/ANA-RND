// Direct-download PDF export — screenshots each rendered slide
// (CollectionSlideDeck's `[data-pdf-slide]` elements) into one PDF page
// each, so clicking "Xuất PDF" behaves like "Xuất PPTX": an automatic
// file download, no OS print dialog in between.
//
// html2canvas-pro (a maintained fork of the abandoned html2canvas) is
// used instead of the original because this app's CSS tokens are mostly
// defined with oklch(), which the original html2canvas can't parse.
//
// This does mean the PDF's product-info text is a raster image, not
// selectable text — same visual result as the print-based approach it
// replaced, just without the manual "choose PDF printer" step.

const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625; // 16:9

export async function generateCollectionPdf(container: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-slide]"));
  if (slides.length === 0) throw new Error("No slides to export");

  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: [SLIDE_W_IN, SLIDE_H_IN] });

  for (let i = 0; i < slides.length; i++) {
    const canvas = await html2canvas(slides[i], { scale: 2, backgroundColor: "#ffffff" });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage([SLIDE_W_IN, SLIDE_H_IN], "landscape");
    doc.addImage(dataUrl, "JPEG", 0, 0, SLIDE_W_IN, SLIDE_H_IN);
  }

  doc.save(fileName);
}
