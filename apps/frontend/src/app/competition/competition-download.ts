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
  link.click();
  URL.revokeObjectURL(url);
}

/** Prints a small HTML page (lists for the pool deck) through a hidden frame. */
export function printHtml(title: string, body: string, landscape = false): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title><style>` +
      `@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm}` +
      'body{font:12px/1.35 system-ui,sans-serif;color:#111}h1{font-size:18px;margin:0 0 4px}' +
      '.sub{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%;margin-bottom:12px}' +
      'th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee}' +
      `</style></head><body>${body}</body></html>`,
  );
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60000);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
