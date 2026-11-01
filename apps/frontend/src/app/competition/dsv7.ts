import { addDays } from '../training/training-dates';
import {
  CompEvent,
  CompSection,
  Competition,
  Entry,
  RelayEntry,
  emptyPlan,
  emptySchedule,
  Sex,
  Stroke,
  Style,
  dateOf,
} from './competition.models';

export interface ParsedMeet {
  format: string;
  competition: Omit<Competition, 'id'>;
  warnings: string[];
}

function isoDate(german: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(german.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function germanDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

function money(text: string | undefined): number {
  const value = Number((text ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

/** Text of a DSV7 file; the files are UTF-8 today, older ones may still be ISO-8859-1. */
export function decodeDsv7(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function emptyMeet(): Omit<Competition, 'id'> {
  return {
    title: '',
    place: '',
    pool: 25,
    timing: 'HANDZEIT',
    venueName: '',
    venueStreet: '',
    venueZip: '',
    venueCity: '',
    organiser: '',
    host: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    note: '',
    deadline: '',
    deadlineTime: '00:00',
    internalDeadline: '',
    open: false,
    groupIds: [],
    flatFee: 0,
    perSwimmerFee: 0,
    discount: 0,
    bank: { holder: '', bank: '', iban: '', bic: '' },
    sent: false,
    sections: [],
    events: [],
    officials: {},
    coaches: {},
    plan: emptyPlan(),
    schedule: emptySchedule(),
  };
}

/**
 * Reads the announcement or any other DSV7 file of the meet (definition list, entry file, result
 * list): title, place, deadline, sections, events and, when given, entry fees and bank data.
 */
export function parseDsv7(text: string): ParsedMeet {
  const meet = emptyMeet();
  const warnings: string[] = [];
  const years = new Map<number, { low: number; high: number }>();
  const fees: { kind: 'E' | 'S' | 'all'; no: number; amount: number }[] = [];
  let format = '';
  let skipped = 0;

  for (const raw of text.split(/\r?\n/)) {
    const comment = /\(\*(.*?)\*\)/.exec(raw)?.[1]?.trim() ?? '';
    const line = raw.replace(/\(\*.*?\*\)/g, '').trim();
    if (!line) {
      const holder = /^KONTOINHABER:\s*([^;]+)/i.exec(comment)?.[1];
      if (holder) meet.bank.holder = holder.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toUpperCase();
    const fields = line
      .slice(colon + 1)
      .split(';')
      .map((field) => field.trim());
    const rawCount = fields.length;
    while (fields.length > 0 && fields[fields.length - 1] === '') fields.pop();

    switch (key) {
      case 'FORMAT':
        format = fields[0] ?? '';
        break;
      case 'VERANSTALTUNG':
        meet.title = fields[0] ?? '';
        meet.place = fields[1] ?? '';
        meet.pool = Number(fields[2]) || 25;
        meet.timing = (fields[3] ?? 'HANDZEIT').toUpperCase().replace('AUTOMATIK', 'AUTOMATISCH');
        break;
      case 'VERANSTALTUNGSORT':
        [meet.venueName, meet.venueStreet, meet.venueZip, meet.venueCity] = [
          fields[0] ?? '',
          fields[1] ?? '',
          fields[2] ?? '',
          fields[3] ?? '',
        ];
        break;
      case 'VERANSTALTER':
        meet.organiser = fields[0] ?? '';
        break;
      case 'AUSRICHTER':
        meet.host = fields[0] ?? '';
        if (!meet.contactEmail) meet.contactEmail = fields[8] ?? '';
        break;
      case 'MELDEADRESSE':
        meet.contactName = fields[0] ?? '';
        meet.contactEmail = fields[7] ?? meet.contactEmail;
        meet.contactPhone = fields[5] ?? '';
        break;
      case 'MELDESCHLUSS':
        meet.deadline = isoDate(fields[0] ?? '');
        meet.deadlineTime = fields[1] || '00:00';
        break;
      case 'BANKVERBINDUNG':
        // Bank; IBAN; BIC; (DSV8: account holder). The holder may also sit in a comment.
        meet.bank = {
          holder: fields[3] || meet.bank.holder,
          bank: fields[0] ?? '',
          iban: fields[1] ?? '',
          bic: fields[2] ?? '',
        };
        break;
      case 'BESONDERES':
        meet.note = fields.join('; ');
        break;
      case 'ABSCHNITT': {
        // Long form: no;date;entry;judges;start;relative; (+ empty tail). Short: no;date;start;relative;
        const long = rawCount >= 7;
        const section: CompSection = {
          no: Number(fields[0]),
          date: isoDate(fields[1] ?? ''),
          entry: long ? (fields[2] ?? '') : '',
          warmup: '',
          judges: long ? (fields[3] ?? '') : '',
          start: long ? (fields[4] ?? '') : (fields[2] ?? ''),
          relative: (long ? fields[5] : fields[3]) === 'J',
        };
        if (section.no > 0 && !meet.sections.some((item) => item.no === section.no)) {
          meet.sections.push(section);
        }
        break;
      }
      case 'WETTKAMPF': {
        const art = fields[1] ?? 'E';
        if (art !== 'E' && art !== 'V') {
          skipped++;
          break;
        }
        const event: CompEvent = {
          no: Number(fields[0]),
          section: Number(fields[2]) || 1,
          count: Number(fields[3]) || 1,
          distance: Number(fields[4]) || 0,
          stroke: ((fields[5] ?? 'F') as Stroke) || 'F',
          style: ((fields[6] ?? 'GL') as Style) || 'GL',
          sex: ((fields[7] ?? 'X') as Sex) || 'X',
          birthYears: 'offen',
          fee: 0,
        };
        if (event.stroke === 'X' && comment) event.name = comment;
        if (event.no > 0 && !meet.events.some((item) => item.no === event.no)) {
          meet.events.push(event);
        }
        break;
      }
      case 'WERTUNG': {
        // WERTUNG: event; E/V; id; JG; from; to; sex; name. A "from" of 0 means "and older".
        const no = Number(fields[0]);
        const from = Number(fields[4]);
        const to = Number(fields[5]);
        if (no > 0 && fields[3] === 'JG' && Number.isFinite(from) && to >= 1900) {
          const range = years.get(no) ?? { low: 9999, high: 0 };
          years.set(no, {
            low: from === 0 ? 0 : Math.min(range.low, from),
            high: Math.max(range.high, to),
          });
        }
        break;
      }
      case 'MELDEGELD': {
        const kind = (fields[0] ?? '').toUpperCase();
        const amount = money(fields[1]);
        const no = Number(fields[2]);
        if (kind === 'MELDEGELDPAUSCHALE') meet.flatFee = amount;
        else if (kind.includes('MELDEGELD')) {
          // "Einzelmeldegeld", "Staffelmeldegeld" or "Wkmeldegeld" (one amount per event number).
          fees.push({
            kind: kind.startsWith('EINZEL') ? 'E' : kind.startsWith('STAFFEL') ? 'S' : 'all',
            no: no > 0 ? no : 0,
            amount,
          });
        }
        break;
      }
    }
  }

  for (const event of meet.events) {
    const range = years.get(event.no);
    if (range) {
      event.birthYears =
        range.low === 0
          ? `bis ${range.high}`
          : range.low === range.high
            ? String(range.low)
            : `${range.low} - ${range.high}`;
    }
    const relay = event.count > 1;
    for (const fee of fees) {
      const general = fee.no === 0 && (fee.kind === 'all' || fee.kind === (relay ? 'S' : 'E'));
      if (fee.no === event.no || general) event.fee = fee.amount;
    }
  }

  meet.sections.sort((a, b) => a.no - b.no);
  meet.events.sort((a, b) => a.no - b.no);
  if (!meet.venueCity) meet.venueCity = meet.place;
  if (!meet.bank.holder) meet.bank.holder = meet.host || meet.organiser;
  if (meet.deadline) meet.internalDeadline = addDays(meet.deadline, -7);
  if (!meet.title) warnings.push('Kein Name der Veranstaltung gefunden.');
  if (meet.events.length === 0) warnings.push('Keine Wettkämpfe gefunden.');
  if (!meet.deadline) warnings.push('Kein Meldeschluss in der Datei: bitte eintragen.');
  if (!fees.length && !meet.flatFee) warnings.push('Kein Meldegeld in der Datei: bitte eintragen.');
  if (skipped > 0)
    warnings.push(`${skipped} Finale wurden nicht übernommen (nur Meldungen zählen).`);
  return { format, competition: meet, warnings };
}

export interface FileSwimmer {
  personId: string;
  lastName: string;
  firstName: string;
  dsvId: string;
  sex: 'M' | 'W' | 'X';
  year: number;
}

export interface FileClub {
  name: string;
  dsvClubId: string;
  stateId: string;
  contactName: string;
  contactStreet: string;
  contactZip: string;
  contactCity: string;
  contactMail: string;
}

/** "00:31,20" -> "00:00:31,20", the way DSV7 writes times. */
function dsvTime(time: string): string {
  return time ? `00:${time}` : '00:00:00,00';
}

/** The club's entry file (Vereinsmeldeliste) for the meet, as DSV7 text with Windows line ends. */
export function buildEntryFile(
  competition: Competition,
  swimmers: FileSwimmer[],
  entries: Entry[],
  club: FileClub,
  now: Date,
  relays: RelayEntry[] = [],
): string {
  const lines: string[] = [];
  const stamp = `${germanDate(now.toISOString().slice(0, 10))} ${now.toTimeString().slice(0, 5)}`;
  lines.push(
    '(* Vereinsmeldedatei, erzeugt mit dem SGB Portal *)',
    `(* erzeugt am ${stamp} *)`,
    'FORMAT: Vereinsmeldeliste;7;',
    'ERZEUGER: SGB Portal;1;;',
    `VERANSTALTUNG: ${competition.title};${competition.place};${competition.pool};${competition.timing};`,
  );
  for (const section of competition.sections) {
    lines.push(
      `ABSCHNITT: ${section.no};${germanDate(section.date)};${section.start};${section.relative ? 'J' : 'N'};`,
    );
  }
  for (const event of competition.events) {
    lines.push(
      `WETTKAMPF: ${event.no};E;${event.section};${event.count};${event.distance};${event.stroke};${event.style};${event.sex};;;`,
    );
  }
  lines.push(`VEREIN: ${club.name};${club.dsvClubId};${club.stateId};GER;`);
  lines.push(
    `ANSPRECHPARTNER: ${club.contactName};${club.contactStreet};${club.contactZip};${club.contactCity};GER;;;${club.contactMail};`,
  );
  swimmers.forEach((swimmer, index) => {
    const number = index + 1;
    lines.push(
      `PNMELDUNG: ${swimmer.lastName}, ${swimmer.firstName};${swimmer.dsvId};${number};${swimmer.sex};${swimmer.year};;;GER;;;`,
    );
    for (const entry of entries.filter((item) => item.personId === swimmer.personId)) {
      lines.push(`STARTPN: ${number};${entry.eventNo};${dsvTime(entry.time)};`);
    }
  });
  relays.forEach((relay, index) => {
    const id = 1000 + index + 1;
    lines.push(`STMELDUNG: ${relay.team};${id};JG;${relay.year};0;;`);
    lines.push(`STARTST: ${id};${relay.eventNo};${dsvTime(relay.time)};`);
  });
  lines.push('DATEIENDE');
  return lines.join('\r\n') + '\r\n';
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

/** The "Kontrollausdruck": the entries as plain text, for a last check before sending. */
export function buildControlSheet(
  competition: Competition,
  swimmers: FileSwimmer[],
  entries: Entry[],
  relays: RelayEntry[],
  club: FileClub,
): string {
  const rule = '-'.repeat(98);
  const row = (cells: string[]) => `|${cells.join('|')}|`;
  const line = (text: string) => `| ${pad(text, 96)} |`;
  const out: string[] = [
    rule,
    line('K O N T R O L L A U S D R U C K'),
    line(`Veranstaltung: ${competition.title}`),
    line(`Ort          : ${competition.place}`),
    line(`Datum        : ${germanDate(dateOf(competition))}`),
    rule,
    line(`Meldender Verein: ${club.name}`),
    line(`                  DSV-Id: ${club.dsvClubId}, LSV: ${club.stateId}, FINA: GER`),
    line(`Ansprechpartner:  ${club.contactName}`),
    line(`                  ${club.contactStreet}, ${club.contactZip} ${club.contactCity}`),
    line(`                  ${club.contactMail}`),
    rule,
    '|Nr.| Schwimmer(in)                                     | Jg |M/W|DSV-Id|Wk |Strecke |Meldezeit  |',
    rule,
  ];
  const label = (eventNo: number) => {
    const event = competition.events.find((item) => item.no === eventNo);
    if (!event) return '';
    const relay = event.count > 1 ? `${event.count}x` : '';
    return `${relay}${event.distance} ${event.stroke}`;
  };
  let number = 0;
  for (const swimmer of swimmers) {
    number++;
    const mine = entries.filter((item) => item.personId === swimmer.personId);
    mine.forEach((entry, index) => {
      out.push(
        row([
          index === 0 ? String(number).padStart(3) : '   ',
          index === 0 ? pad(`${swimmer.lastName}, ${swimmer.firstName}`, 51) : pad('', 51),
          index === 0 ? String(swimmer.year) : '    ',
          index === 0 ? ` ${swimmer.sex} ` : '   ',
          index === 0 ? pad(swimmer.dsvId, 6) : '      ',
          String(entry.eventNo).padStart(3),
          ` ${pad(label(entry.eventNo), 7)}`,
          `   ${dsvTime(entry.time).slice(3)}`,
        ]),
      );
    });
    out.push(rule);
  }
  for (const relay of relays) {
    number++;
    out.push(
      row([
        String(number).padStart(3),
        pad(`${relay.team}. Mannschaft`, 51),
        String(relay.year),
        ` ${competition.events.find((item) => item.no === relay.eventNo)?.sex ?? 'X'} `,
        '      ',
        String(relay.eventNo).padStart(3),
        ` ${pad(label(relay.eventNo), 7)}`,
        `   ${dsvTime(relay.time).slice(3)}`,
      ]),
      rule,
    );
  }
  return out.join('\r\n') + '\r\n';
}

/** File name like the DSV exports: 2026-12-05-Osnabrue-SGBarnstorf-Me */
export function entryFileName(competition: Competition, clubName: string): string {
  const plain = (text: string) =>
    text
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('Ä', 'Ae')
      .replaceAll('Ö', 'Oe')
      .replaceAll('Ü', 'Ue')
      .replaceAll('ß', 'ss')
      .replace(/[^A-Za-z0-9]/g, '');
  return `${dateOf(competition)}-${plain(competition.place).slice(0, 8)}-${plain(clubName)}-Me`;
}
