import { XLSX_TYPE, columnName, escapeXml } from '../xlsx';
import { ZipFile, createZip } from '../zip';
import {
  assemblyBlocks,
  honourBlocks,
  memberBlocks,
  reportParts,
  sheetBlocks,
  statBlocks,
} from './evaluation.blocks';
import { Evaluation } from './evaluation.logic';
import { Block, Row } from './evaluation.model';

export { XLSX_TYPE };

/** A cell of the sheet: `s` is the style number of the table below, `cs` the columns it spans. */
export interface ReportCell {
  v: string | number;
  s: number;
  cs?: number;
}

export type ReportRow = (ReportCell | null)[];

export interface ReportSheet {
  name: string;
  rows: ReportRow[];
}

/** Styles of the cell formats in `STYLES`, in the order of the Intranet file. */
const STYLE = {
  head: 2,
  center: 3,
  right: 4,
  boldCenter: 5,
  boldRight: 6,
  title: 7,
  left: 8,
  sumLabel: 9,
  sumLabelBold: 10,
  group: 11,
  sumValueBold: 12,
  sumValue: 13,
} as const;

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** The cell formats of the old Intranet export: Calibri 11, thin borders, bold italic headers. */
const STYLES =
  `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><i/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="14">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  '</cellXfs></styleSheet>';

function normalize(value: string | number): string {
  return String(value).replace(/\s+/g, ' ').trim();
}

function rowWidth(row: ReportRow): number {
  return row.reduce((sum: number, cell) => sum + (cell?.cs ?? 1), 0);
}

function tableRows(rows: Row[]): ReportRow[] {
  const out: ReportRow[] = [];
  for (const row of rows) {
    if (row.screen) continue;
    const total = row.kind === 'total';
    const cells: ReportCell[] = [];
    for (const cell of row.cells) {
      if (cell.screen) continue;
      const text = normalize(cell.v);
      const numeric = /^-?\d{1,9}$/.test(text) && !/^0\d/.test(text);
      const bold = !!cell.bold || total;
      const right = cell.align === 'r';
      const left = cell.align === 'l' || row.kind === 'group';
      let style: number = cell.head
        ? STYLE.head
        : bold
          ? right
            ? STYLE.boldRight
            : STYLE.boldCenter
          : right
            ? STYLE.right
            : left
              ? STYLE.left
              : STYLE.center;
      if (row.kind === 'group') style = STYLE.group;
      const made: ReportCell = { v: numeric ? Number(text) : text, s: style };
      if ((cell.span ?? 1) > 1) made.cs = cell.span;
      cells.push(made);
    }
    if (cells.length) out.push(cells);
  }
  return out;
}

/** Turns the tables of a page into rows of cells, with the blank lines of the Intranet export. */
export function blocksToRows(blocks: Block[]): ReportRow[] {
  let out: ReportRow[] = [];
  for (const block of blocks) {
    if (block.type === 'title') {
      if (out.length) out.push([]);
      out.push([{ v: block.text.trim(), s: STYLE.title }]);
    } else if (block.type === 'table') {
      out = out.concat(tableRows(block.rows));
      out.push([]);
    } else if (block.type === 'sum') {
      const text = String(block.value);
      out.push([
        { v: block.label, cs: 5, s: block.labelBold ? STYLE.sumLabelBold : STYLE.sumLabel },
        {
          v: text !== '' && !Number.isNaN(Number(text)) ? Number(text) : text,
          s: block.valueBold ? STYLE.sumValueBold : STYLE.sumValue,
        },
      ]);
    } else if (block.type === 'columns') {
      const combined: ReportRow[] = [];
      let offset = 0;
      for (const column of block.columns) {
        const rows = blocksToRows(column);
        const width = rows.reduce((most, row) => Math.max(most, rowWidth(row)), 0);
        rows.forEach((row, index) => {
          const before = combined[index] ?? [];
          for (let filled = rowWidth(before); filled < offset; filled++) before.push(null);
          combined[index] = before.concat(row);
        });
        offset += width + 1;
      }
      out = out.concat(combined);
      out.push([]);
    } else if (block.type === 'sheet') {
      out = out.concat(blocksToRows(block.blocks));
    }
  }
  return out;
}

function sheetXml(rows: ReportRow[]): string {
  const merges: string[] = [];
  const widths: number[] = [];
  let data = '';
  rows.forEach((row, rowIndex) => {
    let col = 0;
    let cells = '';
    const single = row.filter(Boolean).length === 1;
    for (const cell of row) {
      if (!cell) {
        col++;
        continue;
      }
      const ref = columnName(col) + (rowIndex + 1);
      const style = cell.s ? ` s="${cell.s}"` : '';
      if (typeof cell.v === 'number') cells += `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
      else if (cell.v !== '') {
        cells += `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.v)}</t></is></c>`;
      } else if (cell.s) cells += `<c r="${ref}"${style}/>`;
      const span = cell.cs ?? 1;
      if (span > 1) {
        merges.push(`${ref}:${columnName(col + span - 1)}${rowIndex + 1}`);
        for (let q = 1; q < span; q++) {
          if (cell.s) cells += `<c r="${columnName(col + q)}${rowIndex + 1}" s="${cell.s}"/>`;
        }
      } else if (!single) {
        widths[col] = Math.max(widths[col] ?? 0, Math.min(String(cell.v).length, 42));
      }
      col += span;
    }
    data += `<row r="${rowIndex + 1}">${cells}</row>`;
  });
  const cols = widths
    .map((width, index) =>
      width
        ? `<col min="${index + 1}" max="${index + 1}" width="${Math.max(8, width * 1.15 + 2)}" customWidth="1"/>`
        : '',
    )
    .join('');
  const merged = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  return (
    `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${data}</sheetData>${merged}` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/></worksheet>'
  );
}

/** Sheet names: no forbidden characters, at most 31 long, every name once. */
function uniqueNames(sheets: ReportSheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((sheet) => {
    const base =
      sheet.name
        .replace(/[\\/?*[\]:]/g, ' ')
        .trim()
        .slice(0, 31) || 'Blatt';
    let name = base;
    for (let copy = 2; used.has(name.toLowerCase()); copy++) {
      name = `${base.slice(0, 28)} ${copy}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/** Builds the workbook without any library: one sheet per entry. */
export function createReportXlsx(sheets: ReportSheet[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const text = (name: string, content: string): ZipFile => ({
    name,
    data: encoder.encode(content),
  });
  const names = uniqueNames(sheets);
  const types =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>';
  const relations =
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const workbook =
    `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    names
      .map(
        (name, index) =>
          `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      )
      .join('') +
    '</sheets></workbook>';
  return createZip([
    text('[Content_Types].xml', types),
    text(
      '_rels/.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    text('xl/workbook.xml', workbook),
    text('xl/_rels/workbook.xml.rels', relations),
    text('xl/styles.xml', STYLES),
    ...sheets.map((sheet, index) =>
      text(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows)),
    ),
  ]);
}

/**
 * All sheets of the yearly evaluation like the old Intranet: the three ranking sheets, members,
 * events, the overview for the general assembly, cups and medals, and one sheet per swimmer.
 */
export function evaluationSheets(ev: Evaluation, year: string): ReportSheet[] {
  const list = ev.ranking(year, 'best');
  const sheets: ReportSheet[] = reportParts(ev, year, list).map((part) => ({
    name: part.name,
    rows: blocksToRows(part.blocks),
  }));
  sheets.push(
    { name: 'Mitgliederstatistik', rows: blocksToRows(memberBlocks(ev, year)) },
    { name: 'Veranstaltungsstatistik', rows: blocksToRows(statBlocks(ev, year)) },
    { name: 'Übersicht für JHV', rows: blocksToRows(assemblyBlocks(ev, year, list)) },
    {
      name: 'Pokale und Medaillen',
      rows: blocksToRows(honourBlocks(ev, year, list, false)),
    },
  );
  for (const swimmer of [...list].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    sheets.push({ name: swimmer.name, rows: blocksToRows(sheetBlocks(ev, year, swimmer)) });
  }
  return sheets;
}

export function evaluationFileName(year: string): string {
  return `Jahresauswertung_${year}.xlsx`;
}
