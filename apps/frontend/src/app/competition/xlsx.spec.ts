import { clubLogoBytes } from './club-logo';
import { XlsxBook, columnName, createXlsx, excelDate, headWidth } from './xlsx';

/** Reads a ZIP whose files are stored, like the one `createZip` writes. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 30, at + 30 + view.getUint16(at + 26, true)),
    );
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    files.set(name, bytes.subarray(start, start + size));
    at = start + size;
  }
  return files;
}

function text(files: Map<string, Uint8Array>, name: string): string {
  return new TextDecoder().decode(files.get(name));
}

const BOOK: XlsxBook = {
  title: 'Laufzettel nach Wettkampffolge',
  subtitle: 'Beispiel-Schwimmfest · Sa, 05.12.2026 · Beispielstadt',
  sheets: [
    {
      name: 'Laufzettel',
      head: ['Uhr', 'Schwimmer', 'Meldegeld', 'Datum'],
      rows: [
        ['10:05', 'Anna <Muster> & Co', 12.5, '05.12.2026'],
        ['10:08', 'Berta Beispiel', null, ''],
        ['10:11', 'Clara Test', 5, 'kein Datum'],
      ],
      widths: [8, 26, 12, 12],
      formats: ['center', 'text', 'euro', 'date'],
      rowHeight: 26,
      breaksAfter: [0, 2],
    },
  ],
};

describe('createXlsx', () => {
  const files = readZip(createXlsx(BOOK));
  const sheet = text(files, 'xl/worksheets/sheet1.xml');

  it('keeps headings on one line: no wrapping and columns at least as wide as the heading', () => {
    expect(text(files, 'xl/styles.xml')).not.toContain('wrapText');
    const wide = text(
      readZip(
        createXlsx({
          title: 'T',
          subtitle: 'S',
          sheets: [{ name: 'A', head: ['Ein sehr langer Spaltentitel'], rows: [], widths: [6] }],
        }),
      ),
      'xl/worksheets/sheet1.xml',
    );
    expect(wide).toContain(`width="${headWidth('Ein sehr langer Spaltentitel')}"`);
    expect(headWidth('Uhr')).toBeGreaterThanOrEqual(6);
  });

  it('packs the parts of a workbook with the club logo', () => {
    expect([...files.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/media/logo.png',
        'xl/worksheets/sheet1.xml',
        'xl/drawings/drawing1.xml',
      ]),
    );
    const logo = files.get('xl/media/logo.png')!;
    expect([...logo.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(logo).toEqual(clubLogoBytes());
  });

  it('writes the club header right-aligned above the table, like the Intranet', () => {
    expect(sheet).toContain(
      '<c r="D1" s="1" t="inlineStr"><is><t xml:space="preserve">Schwimmgemeinschaft Barnstorf e.V.',
    );
    expect(sheet).toContain('>Laufzettel nach Wettkampffolge</t>');
    expect(sheet).toContain('>Beispiel-Schwimmfest · Sa, 05.12.2026 · Beispielstadt</t>');
    expect(sheet).toContain('<row r="5" ht="24" customHeight="1">');
    expect(sheet).toContain(
      '<pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/>',
    );
    expect(sheet).toContain('<autoFilter ref="A5:D8"/>');
    expect(sheet).toContain('<drawing r:id="rId1"/>');
  });

  it('sets up the print: header row on every page, footer, page breaks, A4', () => {
    const book = text(files, 'xl/workbook.xml');
    expect(book).toContain('_xlnm.Print_Titles');
    expect(book).toContain("'Laufzettel'!$5:$5");
    expect(book).toContain('_xlnm._FilterDatabase');
    expect(sheet).toContain('paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"');
    expect(sheet).toContain('Seite &amp;P von &amp;N');
    // Data row 0 is sheet row 6; the break after the last row is dropped.
    expect(sheet).toContain(
      '<rowBreaks count="1" manualBreakCount="1"><brk id="6" max="16383" man="1"/>',
    );
  });

  it('gives data rows the requested height and escapes text', () => {
    expect(sheet).toContain('<row r="6" ht="26" customHeight="1">');
    expect(sheet).toContain('Anna &lt;Muster&gt; &amp; Co');
  });

  it('stores amounts and dates as numbers and keeps other text as it is', () => {
    expect(sheet).toContain('<c r="C6" s="7"><v>12.5</v></c>');
    expect(sheet).toContain(`<c r="D6" s="6"><v>${excelDate('05.12.2026')}</v></c>`);
    expect(sheet).toContain('<c r="C7" s="5"/>');
    expect(sheet).toContain('>kein Datum</t>');
  });
});

describe('workbook details', () => {
  it('uses landscape for more than six columns and valid, unique sheet names', () => {
    const wide = {
      name: 'A/B: Liste?',
      head: ['1', '2', '3', '4', '5', '6', '7'],
      rows: [],
    };
    const files = readZip(
      createXlsx({
        title: 'Test',
        subtitle: '',
        sheets: [wide, { ...wide, name: 'A B  Liste ' }, { ...wide, name: '' }],
      }),
    );
    const book = text(files, 'xl/workbook.xml');
    expect(text(files, 'xl/worksheets/sheet1.xml')).toContain('orientation="landscape"');
    expect(book).toContain('<sheet name="A B  Liste" sheetId="1"');
    expect(book).toContain('<sheet name="A B  Liste 2" sheetId="2"');
    expect(book).toContain('<sheet name="Tabelle 3" sheetId="3"');
    // The title carries the sheet name when there are several sheets.
    expect(text(files, 'xl/worksheets/sheet3.xml')).toContain('>Test – Tabelle 3</t>');
  });

  it('counts columns like a spreadsheet and converts dates to day numbers', () => {
    expect(columnName(0)).toBe('A');
    expect(columnName(25)).toBe('Z');
    expect(columnName(26)).toBe('AA');
    expect(excelDate('30.05.2026')).toBe(46172);
    expect(excelDate('2026-05-30')).toBeNull();
  });
});
