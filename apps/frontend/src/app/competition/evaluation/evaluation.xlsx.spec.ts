import { Block, Row } from './evaluation.model';
import { blocksToRows, createReportXlsx } from './evaluation.xlsx';

/** Reads a ZIP whose files are stored, like the one `createZip` writes. */
function readZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + view.getUint16(at + 28, true);
    files.set(name, new TextDecoder().decode(bytes.subarray(start, start + size)));
    at = start + size;
  }
  return files;
}

const HEAD: Row = {
  cells: [
    { v: 'Platz', head: true },
    { v: 'Name', head: true },
    { v: 'Punkte', head: true },
  ],
};

const TABLE: Block = {
  type: 'table',
  style: 'rank',
  rows: [
    HEAD,
    {
      cells: [
        { v: 1, align: 'r' },
        { v: 'Anna Muster', align: 'l' },
        { v: 1234, bold: true },
      ],
    },
    {
      cells: [{ v: '0123' }, { v: '  Bea   Beispiel ', align: 'l' }, { v: '12,50 €', align: 'r' }],
    },
    { screen: true, cells: [{ v: 'nur auf dem Bildschirm' }] },
    {
      kind: 'total',
      cells: [
        { v: 'Gesamt', align: 'l', span: 2 },
        { v: 7, align: 'r' },
        { v: 'Bearbeiten', screen: true },
      ],
    },
  ],
};

describe('blocksToRows', () => {
  it('writes the title, the table and a blank line like the Intranet export', () => {
    const rows = blocksToRows([{ type: 'title', text: ' Rangliste ', level: 2 }, TABLE]);
    expect(rows).toEqual([
      [{ v: 'Rangliste', s: 7 }],
      [
        { v: 'Platz', s: 2 },
        { v: 'Name', s: 2 },
        { v: 'Punkte', s: 2 },
      ],
      [
        { v: 1, s: 4 },
        { v: 'Anna Muster', s: 8 },
        { v: 1234, s: 5 },
      ],
      [
        { v: '0123', s: 3 },
        { v: 'Bea Beispiel', s: 8 },
        { v: '12,50 €', s: 4 },
      ],
      [
        { v: 'Gesamt', s: 5, cs: 2 },
        { v: 7, s: 6 },
      ],
      [],
    ]);
  });

  it('leaves a blank line before every further title', () => {
    const rows = blocksToRows([
      { type: 'title', text: 'Erste', level: 2 },
      { type: 'title', text: 'Zweite', level: 2 },
    ]);
    expect(rows).toEqual([[{ v: 'Erste', s: 7 }], [], [{ v: 'Zweite', s: 7 }]]);
  });

  it('puts the sum lines under a sheet: label over five columns, value in the sixth', () => {
    const rows = blocksToRows([
      {
        type: 'sheet',
        blocks: [
          { type: 'sum', label: 'Summe:', value: 1787, labelBold: false, valueBold: true },
          { type: 'sum', label: 'Durchschnitt:', value: 596, labelBold: true, valueBold: false },
          {
            type: 'sum',
            label: 'Hinweis:',
            value: 'kein Wert',
            labelBold: false,
            valueBold: false,
          },
        ],
      },
    ]);
    expect(rows).toEqual([
      [
        { v: 'Summe:', cs: 5, s: 9 },
        { v: 1787, s: 12 },
      ],
      [
        { v: 'Durchschnitt:', cs: 5, s: 10 },
        { v: 596, s: 13 },
      ],
      [
        { v: 'Hinweis:', cs: 5, s: 9 },
        { v: 'kein Wert', s: 13 },
      ],
    ]);
  });

  it('places tables side by side with one empty column between them', () => {
    const small = (title: string, cells: string[]): Block[] => [
      { type: 'title', text: title, level: 2 },
      { type: 'table', style: 'info', rows: [{ cells: cells.map((v) => ({ v })) }] },
    ];
    const rows = blocksToRows([
      { type: 'columns', columns: [small('Links', ['a', 'b']), small('Rechts', ['c', 'd', 'e'])] },
    ]);
    expect(rows[0]).toEqual([{ v: 'Links', s: 7 }, null, null, { v: 'Rechts', s: 7 }]);
    expect(rows[1]).toEqual([
      { v: 'a', s: 3 },
      { v: 'b', s: 3 },
      null,
      { v: 'c', s: 3 },
      { v: 'd', s: 3 },
      { v: 'e', s: 3 },
    ]);
    expect(rows[rows.length - 1]).toEqual([]);
  });

  it('writes group lines of a sheet in bold on the left over the whole width', () => {
    const rows = blocksToRows([
      {
        type: 'table',
        style: 'sheet',
        rows: [{ kind: 'group', cells: [{ v: '50m Rücken', align: 'l', bold: true, span: 6 }] }],
      },
    ]);
    expect(rows[0]).toEqual([{ v: '50m Rücken', s: 11, cs: 6 }]);
  });

  it('skips notes, which are only for the screen', () => {
    expect(blocksToRows([{ type: 'note', text: 'Nur ein Hinweis' }])).toEqual([]);
  });
});

describe('createReportXlsx', () => {
  const rows = blocksToRows([{ type: 'title', text: 'Rangliste', level: 2 }, TABLE]);
  const files = readZip(
    createReportXlsx([
      { name: 'Auswertung Gesamt', rows },
      { name: 'Brust/Rücken: 50m', rows: [] },
      { name: 'x'.repeat(40), rows: [] },
      { name: 'Auswertung Gesamt', rows: [] },
    ]),
  );

  it('packs the parts of a workbook', () => {
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml',
      'xl/worksheets/sheet4.xml',
    ]);
  });

  it('names the sheets without forbidden characters, at most 31 long, every name once', () => {
    const names = [...(files.get('xl/workbook.xml') ?? '').matchAll(/<sheet name="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(names).toEqual([
      'Auswertung Gesamt',
      'Brust Rücken  50m',
      'x'.repeat(31),
      'Auswertung Gesamt 2',
    ]);
  });

  it('uses the cell formats of the Intranet export: Calibri 11 and fourteen styles', () => {
    const styles = files.get('xl/styles.xml') ?? '';
    expect(styles).toContain('<name val="Calibri"/>');
    expect(styles).toContain('<cellXfs count="14">');
    expect(styles.split('<xf numFmtId="0" fontId=').length - 1).toBe(15);
  });

  it('writes numbers as numbers and text as inline strings, without gridlines', () => {
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('showGridLines="0"');
    expect(sheet).toContain(
      '<c r="A1" s="7" t="inlineStr"><is><t xml:space="preserve">Rangliste</t></is></c>',
    );
    expect(sheet).toContain('<c r="A3" s="4"><v>1</v></c>');
    expect(sheet).toContain(
      '<c r="B4" s="8" t="inlineStr"><is><t xml:space="preserve">Bea Beispiel</t></is></c>',
    );
    expect(sheet).toContain(
      '<c r="A4" s="3" t="inlineStr"><is><t xml:space="preserve">0123</t></is></c>',
    );
    expect(sheet).toContain('<mergeCell ref="A5:B5"/>');
  });

  it('sets the column widths from the longest text, at least 8', () => {
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('<col min="1" max="1" width="8" customWidth="1"/>');
    expect(sheet).toContain('<col min="2" max="2" width="15.');
  });
});
