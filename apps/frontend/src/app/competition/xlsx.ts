import { clubLogoBytes } from './club-logo';
import { createZip, ZipFile } from './zip';

/**
 * A small Excel writer for the lists of the club. The layout is the one of the old Intranet:
 * the logo at the top left, the club name, the title and a subtitle right-aligned above the
 * table, a bold header row with a light blue fill, thin borders, a frozen header, a filter and
 * an A4 print setup. On top of that every page repeats the header row and carries a footer with
 * the page number.
 */

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const CLUB_TITLE = 'Schwimmgemeinschaft Barnstorf e.V.';

export type XlsxValue = string | number | null | undefined;

/**
 * How a column looks: left-aligned text, centred text or number, a plain number, an amount in
 * euro, or a date typed as "dd.mm.yyyy" (stored as a real date).
 */
export type XlsxFormat = 'text' | 'center' | 'number' | 'euro' | 'date';

export interface XlsxSheet {
  name: string;
  head: string[];
  rows: XlsxValue[][];
  /** Column widths in characters. */
  widths?: number[];
  formats?: XlsxFormat[];
  /** Landscape is the default for more than six columns. */
  orientation?: 'portrait' | 'landscape';
  /** Height of the data rows in points; taller rows leave room for handwriting. */
  rowHeight?: number;
  /** Indexes of data rows that end a printed page (one section per page, say). */
  breaksAfter?: number[];
}

export interface XlsxBook {
  /** Second line of the header, e.g. "Laufzettel nach Wettkampffolge". */
  title: string;
  /** Third line of the header, e.g. the meet, the date and the place. */
  subtitle: string;
  sheets: XlsxSheet[];
}

/** Rows above the table: club, title, subtitle and a spacer; the header row follows. */
const HEADER_ROW = 5;

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Indexes into `cellXfs` of the style sheet below. */
const STYLE = {
  club: 1,
  title: 2,
  subtitle: 3,
  head: 4,
  text: 5,
  date: 6,
  euro: 7,
  number: 8,
  headCentre: 9,
  centre: 10,
} as const;

const STYLES =
  `${XML}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/>' +
  '<numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>' +
  '<fonts count="5">' +
  '<font><sz val="10"/><color rgb="FF000000"/><name val="Arial"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF000000"/><name val="Arial"/></font>' +
  '<font><b/><sz val="13"/><color rgb="FF000000"/><name val="Arial"/></font>' +
  '<font><sz val="11"/><color rgb="FF000000"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FF000000"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right>' +
  '<top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="11">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** Text for XML: special characters escaped, control characters dropped. */
export function escapeXml(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
    out +=
      char === '&'
        ? '&amp;'
        : char === '<'
          ? '&lt;'
          : char === '>'
            ? '&gt;'
            : char === '"'
              ? '&quot;'
              : char;
  }
  return out;
}

/** Column letters: 0 is "A", 26 is "AA". */
export function columnName(index: number): string {
  let name = '';
  let rest = index + 1;
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    rest = Math.floor((rest - 1) / 26);
  }
  return name;
}

/** Excel day number of "dd.mm.yyyy"; null for anything else. */
export function excelDate(text: string): number | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Math.round((day - Date.UTC(1899, 11, 30)) / 86400000);
}

function sheetNames(sheets: XlsxSheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((sheet, index) => {
    const base =
      sheet.name
        .replace(/[\\/?*[\]:]/g, ' ')
        .trim()
        .slice(0, 31) || `Tabelle ${index + 1}`;
    let name = base;
    for (let copy = 2; used.has(name.toLowerCase()); copy++) {
      name = `${base.slice(0, 28)} ${copy}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function cellXml(
  column: number,
  row: number,
  value: XlsxValue,
  style: number,
  format: XlsxFormat = 'text',
): string {
  const ref = `${columnName(column)}${row}`;
  if (value === '' || value === null || value === undefined) return `<c r="${ref}" s="${style}"/>`;
  if (style === STYLE.text || style === STYLE.centre) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const numeric =
        format === 'euro' ? STYLE.euro : format === 'center' ? STYLE.centre : STYLE.number;
      return `<c r="${ref}" s="${numeric}"><v>${value}</v></c>`;
    }
    if (format === 'date') {
      const serial = excelDate(String(value));
      if (serial !== null) return `<c r="${ref}" s="${STYLE.date}"><v>${serial}</v></c>`;
    }
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

/** Width in characters that a bold heading needs on one line, with room for the filter arrow. */
export function headWidth(text: string): number {
  return Math.ceil(text.length * 1.2) + 3;
}

function sheetXml(sheet: XlsxSheet, title: string, subtitle: string): string {
  const columns = sheet.head.length;
  const last = columnName(columns - 1);
  const formats = sheet.formats ?? [];
  const lastRow = HEADER_ROW + sheet.rows.length;
  const landscape = (sheet.orientation ?? (columns > 6 ? 'landscape' : 'portrait')) === 'landscape';
  const centred = (index: number) => formats[index] === 'center';

  let xml =
    `${XML}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${HEADER_ROW}" topLeftCell="A${HEADER_ROW + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/><cols>' +
    sheet.head
      .map(
        (head, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${Math.max(sheet.widths?.[index] ?? 16, headWidth(head))}" customWidth="1"/>`,
      )
      .join('') +
    '</cols><sheetData>';

  xml += `<row r="1" ht="30" customHeight="1">${cellXml(columns - 1, 1, CLUB_TITLE, STYLE.club)}</row>`;
  xml += `<row r="2" ht="24" customHeight="1">${cellXml(columns - 1, 2, title, STYLE.title)}</row>`;
  xml += `<row r="3" ht="19.5" customHeight="1">${cellXml(columns - 1, 3, subtitle, STYLE.subtitle)}</row>`;
  xml += '<row r="4" ht="12.75" customHeight="1"/>';
  xml += `<row r="${HEADER_ROW}" ht="24" customHeight="1">${sheet.head
    .map((head, index) =>
      cellXml(index, HEADER_ROW, head, centred(index) ? STYLE.headCentre : STYLE.head),
    )
    .join('')}</row>`;

  const height = sheet.rowHeight ? ` ht="${sheet.rowHeight}" customHeight="1"` : '';
  sheet.rows.forEach((row, rowIndex) => {
    const number = HEADER_ROW + 1 + rowIndex;
    xml +=
      `<row r="${number}"${height}>` +
      sheet.head
        .map((_, index) =>
          cellXml(
            index,
            number,
            row[index],
            centred(index) ? STYLE.centre : STYLE.text,
            formats[index] ?? 'text',
          ),
        )
        .join('') +
      '</row>';
  });

  xml +=
    `</sheetData><autoFilter ref="A${HEADER_ROW}:${last}${lastRow}"/>` +
    '<printOptions horizontalCentered="1"/>' +
    '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.6" header="0.2" footer="0.25"/>' +
    `<pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    `<headerFooter><oddFooter>&amp;L&amp;9${escapeXml(CLUB_TITLE)}&amp;C&amp;9Seite &amp;P von &amp;N&amp;R&amp;9&amp;D</oddFooter></headerFooter>`;

  const breaks = (sheet.breaksAfter ?? []).filter((at) => at >= 0 && at < sheet.rows.length - 1);
  if (breaks.length > 0) {
    xml +=
      `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">` +
      breaks.map((at) => `<brk id="${HEADER_ROW + 1 + at}" max="16383" man="1"/>`).join('') +
      '</rowBreaks>';
  }
  return `${xml}<drawing r:id="rId1"/></worksheet>`;
}

const DRAWING =
  `${XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}">` +
  '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
  '<xdr:ext cx="2181225" cy="561975"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo" descr="SG Barnstorf Sharks"/>' +
  '<xdr:cNvPicPr preferRelativeResize="0"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
  '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';

/** Builds the workbook: one sheet per list, each with the club header and the logo. */
export function createXlsx(book: XlsxBook): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const text = (name: string, content: string): ZipFile => ({
    name,
    data: encoder.encode(content),
  });
  const names = sheetNames(book.sheets);
  const files: ZipFile[] = [];

  let types =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  let sheets = '';
  let relations = `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rIdS" Type="${NS_REL}/styles" Target="styles.xml"/>`;
  let defined = '';

  book.sheets.forEach((sheet, index) => {
    const number = index + 1;
    const name = escapeXml(names[index]);
    const quoted = `'${names[index].replaceAll("'", "''")}'`;
    const head = sheet.head.length;
    const heading =
      book.sheets.length > 1 && names[index].toLowerCase() !== book.title.toLowerCase()
        ? `${book.title} – ${names[index]}`
        : book.title;
    types +=
      `<Override PartName="/xl/worksheets/sheet${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/drawings/drawing${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
    sheets += `<sheet name="${name}" sheetId="${number}" r:id="rId${number}"/>`;
    relations += `<Relationship Id="rId${number}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${number}.xml"/>`;
    defined +=
      `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${escapeXml(quoted)}!$A$${HEADER_ROW}:$${columnName(head - 1)}$${HEADER_ROW + sheet.rows.length}</definedName>` +
      `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${escapeXml(quoted)}!$${HEADER_ROW}:$${HEADER_ROW}</definedName>`;
    files.push(
      text(`xl/worksheets/sheet${number}.xml`, sheetXml(sheet, heading, book.subtitle)),
      text(
        `xl/worksheets/_rels/sheet${number}.xml.rels`,
        `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_REL}/drawing" Target="../drawings/drawing${number}.xml"/></Relationships>`,
      ),
      text(`xl/drawings/drawing${number}.xml`, DRAWING),
      text(
        `xl/drawings/_rels/drawing${number}.xml.rels`,
        `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_REL}/image" Target="../media/logo.png"/></Relationships>`,
      ),
    );
  });

  return createZip([
    text('[Content_Types].xml', `${types}</Types>`),
    text(
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    text(
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${sheets}</sheets><definedNames>${defined}</definedNames></workbook>`,
    ),
    text('xl/_rels/workbook.xml.rels', `${relations}</Relationships>`),
    text('xl/styles.xml', STYLES),
    { name: 'xl/media/logo.png', data: clubLogoBytes() },
    ...files,
  ]);
}
