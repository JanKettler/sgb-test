import { CLUB_LOGO_DATA_URL } from './club-logo';
import { CLUB_TITLE, XLSX_TYPE, XlsxBook, createXlsx } from './xlsx';

/** Offers bytes as a file download. */
export function downloadBytes(
  filename: string,
  bytes: Uint8Array<ArrayBuffer>,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  // Safari needs a moment before the address of the file may go away.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

/** Offers an Excel list (with the club header and the logo) as a download. */
export function downloadXlsx(filename: string, book: XlsxBook): void {
  downloadBytes(filename, createXlsx(book), XLSX_TYPE);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface PrintOptions {
  landscape?: boolean;
  /** Extra styles for the page. */
  css?: string;
}

const PRINT_CSS =
  'body{font:12px/1.5 Helvetica,Arial,sans-serif;color:#111;margin:16px}' +
  '.kopf{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:0 0 22px}' +
  '.kopf img{height:62px;width:auto;display:block}' +
  '.kopf .r{text-align:right;font-size:12px;line-height:1.7;color:#222}' +
  'h1{font-size:19px;text-align:center;margin:0 0 14px}' +
  'h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:2px}' +
  'h3{font-size:12.5px;margin:10px 0 4px}' +
  'table{border-collapse:collapse;width:100%;margin:4px 0 10px}' +
  'th,td{border:1px solid #888;padding:4px 6px;text-align:left;vertical-align:top;font-size:11.5px}' +
  'th{background:#eee}thead{display:table-header-group}tr{page-break-inside:avoid}' +
  '.sub{color:#555;font-size:11.5px}.pb{page-break-after:always}' +
  '.slip{border:1px dashed #666;padding:8px 10px;margin:0 0 10px;page-break-inside:avoid}' +
  '.nowrap{white-space:nowrap}.bar{text-align:right;margin:0 0 10px}' +
  '@page{size:A4;margin:14mm}@media print{.bar{display:none}body{margin:0}}';

const BAR =
  '<div class="bar"><button onclick="window.print()" style="font-size:16px;padding:10px 16px">Drucken</button> ' +
  '<button onclick="window.close()" style="font-size:16px;padding:10px 16px">Schließen</button></div>';

/** Takes a leading `<h1>` and `<div class="sub">` out of the body: they become header lines. */
function splitHeading(body: string): { line2: string; line3: string; rest: string } {
  const match = /^\s*<h1>([\s\S]*?)<\/h1>\s*(?:<div class="sub">([\s\S]*?)<\/div>)?/.exec(body);
  if (!match) return { line2: '', line3: '', rest: body };
  const plain = (html: string) =>
    html
      .replace(/<[^>]*>/g, '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&')
      .replace(/\s+/g, ' ')
      .trim();
  return {
    line2: plain(match[1]),
    line3: plain(match[2] ?? ''),
    rest: body.slice(match[0].length),
  };
}

/** A new tab, or null where pop-ups are blocked. */
function openTab(): Window | null {
  try {
    return window.open('', '_blank');
  } catch {
    return null;
  }
}

/**
 * Opens a print page for a list: the club header (logo left, club, title and meet right) and the
 * table. A separate tab works on the iPad as well; where pop-ups are blocked the page covers the
 * current one and goes away again with "Schließen".
 */
export function printHtml(title: string, body: string, options: PrintOptions = {}): void {
  const { line2, line3, rest } = splitHeading(body);
  const header =
    `<div class="kopf"><img src="${CLUB_LOGO_DATA_URL}" alt="SG Barnstorf Sharks"><div class="r">` +
    `<div>${escapeHtml(CLUB_TITLE)}</div>` +
    (line2 ? `<div>${escapeHtml(line2)}</div>` : '') +
    (line3 ? `<div>${escapeHtml(line3)}</div>` : '') +
    '</div></div>';
  const css =
    PRINT_CSS +
    (options.landscape ? '@page{size:A4 landscape;margin:10mm}' : '') +
    (options.css ?? '');

  const popup = openTab();
  if (popup?.document) {
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${BAR}${header}${rest}</body></html>`,
    );
    popup.document.close();
    return;
  }

  let overlay = document.getElementById('print-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML =
    `<style>${css}#print-overlay{position:fixed;inset:0;z-index:2000;background:#fff;color:#111;overflow:auto;padding:12px}` +
    '@media print{body>*:not(#print-overlay){display:none!important}#print-overlay{position:static}}</style>' +
    `<div class="bar"><button onclick="window.print()" style="font-size:16px;padding:10px 16px">Drucken</button> ` +
    `<button onclick="document.getElementById('print-overlay').remove()" style="font-size:16px;padding:10px 16px">Schließen</button></div>` +
    header +
    rest;
}
