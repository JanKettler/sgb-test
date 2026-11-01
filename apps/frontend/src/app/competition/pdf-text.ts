import { PdfItem, linesFromItems } from './wk-parse';

interface PdfPage {
  view: number[];
  getTextContent(): Promise<{ items: { str: string; width: number; transform: number[] }[] }>;
}
interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(source: { data: Uint8Array }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfPage> }>;
  };
}

const VERSION = '3.11.174';
const SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}/pdf.min.js`;
const WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}/pdf.worker.min.js`;

let loading: Promise<PdfLib> | null = null;

/** Loads the PDF reader (pdf.js) from the CDN the first time it is needed. */
function pdfLib(): Promise<PdfLib> {
  const holder = window as unknown as { pdfjsLib?: PdfLib };
  if (holder.pdfjsLib) return Promise.resolve(holder.pdfjsLib);
  loading ??= new Promise<PdfLib>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.onload = () => {
      const lib = holder.pdfjsLib;
      if (!lib) {
        reject(new Error('Der PDF-Leser fehlt.'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = WORKER;
      resolve(lib);
    };
    script.onerror = () => {
      loading = null;
      reject(
        new Error('Der PDF-Leser konnte nicht geladen werden. Bitte Internetverbindung prüfen.'),
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** The text of a PDF file as lines; columns are separated by at least two spaces. */
export async function readPdfLines(file: File): Promise<string[]> {
  const lib = await pdfLib();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data }).promise;
  const pages: PdfItem[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
      })),
    );
  }
  return linesFromItems(pages);
}

/** A DSV7 text file: UTF-8, or Windows-1252 for older programs. */
export async function readTextFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
