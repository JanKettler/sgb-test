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
