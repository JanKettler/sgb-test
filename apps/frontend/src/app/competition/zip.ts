const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

function dosTime(date: Date): { time: number; day: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** A small ZIP writer (files are stored, not compressed); enough for a few text files. */
export function createZip(files: ZipFile[], now = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, day } = dosTime(now);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const header = (size: number): { view: DataView; bytes: Uint8Array } => {
    const bytes = new Uint8Array(size);
    return { view: new DataView(bytes.buffer), bytes };
  };

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true); // UTF-8 names
    local.view.setUint16(10, time, true);
    local.view.setUint16(12, day, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, file.data.length, true);
    local.view.setUint32(22, file.data.length, true);
    local.view.setUint16(26, name.length, true);
    parts.push(local.bytes, name, file.data);

    const entry = header(46);
    entry.view.setUint32(0, 0x02014b50, true);
    entry.view.setUint16(4, 20, true);
    entry.view.setUint16(6, 20, true);
    entry.view.setUint16(8, 0x0800, true);
    entry.view.setUint16(12, time, true);
    entry.view.setUint16(14, day, true);
    entry.view.setUint32(16, crc, true);
    entry.view.setUint32(20, file.data.length, true);
    entry.view.setUint32(24, file.data.length, true);
    entry.view.setUint16(28, name.length, true);
    entry.view.setUint32(42, offset, true);
    central.push(entry.bytes, name);
    offset += 30 + name.length + file.data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);

  const all = [...parts, ...central, end.bytes];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of all) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}
