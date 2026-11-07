export const PDF_RUNTIME = "/pdfjs/6.5.438";
export const PDF_LIMITS = { bytes: 10 * 1048576, pages: 50, characters: 100000 } as const;
export type PdfText = { pages: string[]; emptyPages: number[]; unmappedPages: number[] };
export function pdfPageText(items: ({ str: string; hasEOL?: boolean } | object)[]) {
  // PDF.js already emits layout spaces; adding one per glyph/font run breaks words.
  const raw=items.flatMap(item=>"str" in item&&typeof item.str==="string"?[item.str+("hasEOL" in item&&item.hasEOL?"\n":"")]:[]).join("");
  return {text:raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").trim(),unmapped:/[\u0000\uFFFD]/u.test(raw)};
}
type PdfPage = { getTextContent(): Promise<{ items: ({ str: string; hasEOL?: boolean } | object)[] }>; cleanup(): void };
type PdfDocument = { numPages: number; getPage(page: number): Promise<PdfPage> };
type PdfTask = { promise: Promise<PdfDocument>; destroy(): Promise<void> };
type PdfWorker = { destroy(): void };
type PdfRuntime = { PDFWorker: { create(options: { port: Worker; verbosity: number }): PdfWorker }; getDocument(options: Record<string, unknown>): PdfTask };
const aborted = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException("Cancelled", "AbortError"); };

export async function validatePdf(file: File) {
  if (!file.size || file.size > PDF_LIMITS.bytes) throw new Error("Choose one non-empty PDF up to 10 MiB.");
  if (file.type && !["application/pdf", "application/octet-stream"].includes(file.type)) throw new Error("Choose a text-based PDF, not an image or another document format.");
  const header = new TextDecoder("latin1").decode(await file.slice(0, 1024).arrayBuffer());
  if (!/%PDF-[12]\.\d/.test(header)) throw new Error("This file has no valid PDF header. Choose the original PDF, not a renamed file.");
}

/** Parser runs in a real, job-owned worker; there is deliberately no main-thread fallback. */
export async function readPdf(file: File, signal: AbortSignal, status: (value: string) => void, progress: (value: number) => void): Promise<PdfText> {
  aborted(signal); await validatePdf(file); aborted(signal);
  status("Loading local PDF text parser");
  const modulePath = `${PDF_RUNTIME}/pdf.min.mjs`;
  const pdf = await import(/* webpackIgnore: true */ modulePath) as PdfRuntime;
  aborted(signal); const data = new Uint8Array(await file.arrayBuffer()); aborted(signal);
  let port: Worker;
  try { port = new Worker(`${PDF_RUNTIME}/pdf.worker.min.mjs`, { type: "module" }); }
  catch { throw new Error("PDF reading needs browser workers. Try a current desktop browser."); }
  let task: PdfTask | undefined, worker: PdfWorker | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { stop = reject; });
  const cancel = () => { stop(new DOMException("Cancelled", "AbortError")); port.terminate(); };
  const failure = (event: Event) => { event.preventDefault(); stop(new Error("The PDF worker failed. Reconnect and retry, or use a smaller PDF in a current desktop browser.")); port.terminate(); };
  signal.addEventListener("abort", cancel, { once: true });
  port.addEventListener("error", failure); port.addEventListener("messageerror", failure);
  const race = <T>(promise: Promise<T>) => Promise.race([promise, stopped]);
  try {
    worker = pdf.PDFWorker.create({ port, verbosity: 0 });
    task = pdf.getDocument({ data, worker, verbosity: 0, cMapUrl: `${location.origin}${PDF_RUNTIME}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${location.origin}${PDF_RUNTIME}/standard_fonts/`, useSystemFonts: true, useWorkerFetch: true, disableFontFace: true, useWasm: false, isEvalSupported: false, enableXfa: false, stopAtErrors: true });
    timer = setTimeout(() => { stop(new Error("PDF parsing took too long. Cancelled the worker; try fewer pages or a smaller PDF.")); port.terminate(); }, 90000);
    const document = await race(task.promise); aborted(signal);
    if (!Number.isInteger(document.numPages) || document.numPages < 1 || document.numPages > PDF_LIMITS.pages) throw new Error("Use a PDF with 1–50 pages. Split larger documents first.");
    const pages: string[] = [], emptyPages: number[] = [], unmappedPages: number[] = []; let count = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      aborted(signal); status(`Extracting page ${pageNumber} of ${document.numPages}`);
      const page = await race(document.getPage(pageNumber));
      try {
        const content = await race(page.getTextContent());
        const {text,unmapped}=pdfPageText(content.items);
        if(unmapped)unmappedPages.push(pageNumber);
        count += text.length; if (count > PDF_LIMITS.characters) throw new Error("This PDF has over 100,000 extracted characters. Split it into smaller documents.");
        pages.push(text); if (!text) emptyPages.push(pageNumber); progress(pageNumber / document.numPages);
      } finally { page.cleanup(); }
    }
    if (emptyPages.length === pages.length) throw new Error("No selectable text was found. Scanned/image-only PDFs need OCR, which this tool does not provide.");
    return { pages, emptyPages, unmappedPages };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new Error("Password-protected PDFs are not supported. Unlock a copy locally, then choose it again.");
    if (error instanceof Error && ["InvalidPDFException", "UnknownErrorException", "FormatError"].includes(error.name)) throw new Error("This PDF could not be parsed. It may be corrupt or unsupported; re-export a text-based PDF and retry.");
    throw error;
  } finally {
    clearTimeout(timer); signal.removeEventListener("abort", cancel);
    port.removeEventListener("error", failure); port.removeEventListener("messageerror", failure);
    // Termination is immediate even if a damaged PDF leaves its internal cleanup waiting.
    void task?.destroy().catch(() => {}); worker?.destroy(); port.terminate();
  }
}
