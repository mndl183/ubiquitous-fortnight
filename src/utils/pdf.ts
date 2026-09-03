import { PDFDocument } from 'pdf-lib';

export async function loadPdf(file: File): Promise<PDFDocument> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File is too large. Maximum size is 50MB.');
  }
  const arrayBuffer = await file.arrayBuffer();
  try {
    return await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (err) {
    throw new Error('Could not open this PDF. It may be corrupted or password-protected.');
  }
}

export async function mergePdfs(files: File[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function splitPdf(file: File): Promise<Blob[]> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pageIndices = pdf.getPageIndices();
  const blobs: Blob[] = [];

  for (const index of pageIndices) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdf, [index]);
    newPdf.addPage(page);
    const bytes = await newPdf.save();
    blobs.push(new Blob([bytes], { type: 'application/pdf' }));
  }
  return blobs;
}

export async function extractPages(file: File, pagesToExtract: number[]): Promise<Blob> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(pdf, pagesToExtract);
  pages.forEach((page) => newPdf.addPage(page));
  const bytes = await newPdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function rotatePdf(file: File, degrees: number): Promise<Blob> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pages = pdf.getPages();
  pages.forEach((page) => page.setRotation(...(page.getRotation() ? [page.getRotation().angle + degrees] : [degrees])));
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function compressPdf(file: File, level: 'high' | 'balanced' | 'aggressive' = 'balanced'): Promise<{ blob: Blob; savings: number }> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });

  const options: any = {
    high: {},
    balanced: { useObjectStreams: true },
    aggressive: { useObjectStreams: true },
  };

  const bytes = await pdf.save(options[level] || {});
  const savings = Math.max(0, Math.round((1 - bytes.length / file.size) * 100));
  return { blob: new Blob([bytes], { type: 'application/pdf' }), savings };
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function trackEvent(event: string, params: Record<string, any> = {}): void {
  if (typeof gtag !== 'undefined') {
    gtag('event', event, params);
  }
}
