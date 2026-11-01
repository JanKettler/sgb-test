import { Competition, normalizeTime, yearFits } from './competition.models';
import { buildEntryFile, entryFileName, parseDsv7 } from './dsv7';
import { crc32, createZip } from './zip';

const ANNOUNCEMENT = [
  '(* erzeugt mit einem Testprogramm *)',
  'FORMAT: Wettkampfdefinitionsliste;7;',
  'VERANSTALTUNG: Beispielpokal;Beispielstadt;25;HANDZEIT;',
  'VERANSTALTUNGSORT: Stadtbad;Badweg 1;12345;Beispielstadt;GER;;;;',
  'VERANSTALTER: Beispielverein;',
  'AUSRICHTER: Beispielverein;Frau Muster;Weg 2;12345;Beispielstadt;GER;;;meldung@example.org;',
  'MELDEADRESSE: Frau Muster;Weg 2;12345;Beispielstadt;GER;0123;;meldung@example.org;',
  'MELDESCHLUSS: 20.11.2026;23:59;',
  'BANKVERBINDUNG: Beispielbank;DE00 0000 0000;BEISPDE00;Beispielverein;',
  'ABSCHNITT: 1;05.12.2026;09:00;09:30;10:00;N;',
  'ABSCHNITT: 2;05.12.2026;;;01:00;J;',
  'WETTKAMPF: 1;E;1;1;50;F;GL;M;;;',
  'WETTKAMPF: 2;E;1;1;50;F;GL;W;;;',
  'WETTKAMPF: 3;E;2;4;50;F;GL;X;;;',
  'WETTKAMPF: 4;F;2;1;50;F;GL;M;;;',
  'MELDEGELD: EINZELMELDEGELD;5,00;-1;',
  'MELDEGELD: STAFFELMELDEGELD;8,00;-1;',
  'WERTUNG: 1;E;1001;JG;2012;2014;M;Jahrgang',
].join('\r\n');

describe('parseDsv7', () => {
  it('reads the meet, deadline, sections, events and fees', () => {
    const { competition, warnings, format } = parseDsv7(ANNOUNCEMENT);
    expect(format).toBe('Wettkampfdefinitionsliste');
    expect(competition.title).toBe('Beispielpokal');
    expect(competition.place).toBe('Beispielstadt');
    expect(competition.pool).toBe(25);
    expect(competition.deadline).toBe('2026-11-20');
    expect(competition.deadlineTime).toBe('23:59');
    expect(competition.internalDeadline).toBe('2026-11-13');
    expect(competition.contactEmail).toBe('meldung@example.org');
    expect(competition.bank).toMatchObject({
      holder: 'Beispielverein',
      bank: 'Beispielbank',
      bic: 'BEISPDE00',
    });
    expect(competition.sections).toHaveLength(2);
    expect(competition.sections[0]).toMatchObject({
      entry: '09:00',
      judges: '09:30',
      start: '10:00',
    });
    expect(competition.sections[1]).toMatchObject({ start: '01:00', relative: true });
    // The final (art F) is not an entry event.
    expect(competition.events.map((event) => event.no)).toEqual([1, 2, 3]);
    expect(competition.events[0]).toMatchObject({ fee: 5, birthYears: '2012 - 2014' });
    expect(competition.events[2]).toMatchObject({ count: 4, fee: 8, sex: 'X' });
    expect(warnings.some((text) => text.includes('Finale'))).toBe(true);
  });

  it('reads the short section form of an entry file', () => {
    const { competition } = parseDsv7(
      'FORMAT: Vereinsmeldeliste;7;\nVERANSTALTUNG: Test;Ort;50;Automatik;\nABSCHNITT: 1;03.10.2026;09:30;N;\nWETTKAMPF: 1;E;1;1;400;L;GL;W;;;',
    );
    expect(competition.pool).toBe(50);
    expect(competition.timing).toBe('AUTOMATISCH');
    expect(competition.sections[0]).toMatchObject({
      date: '2026-10-03',
      start: '09:30',
      relative: false,
    });
    expect(competition.events[0]).toMatchObject({ distance: 400, stroke: 'L' });
  });

  it('warns about what is missing', () => {
    const { warnings } = parseDsv7('FORMAT: x;7;');
    expect(warnings.length).toBeGreaterThan(1);
  });
});

describe('entry file', () => {
  const { competition } = parseDsv7(ANNOUNCEMENT);
  const meet: Competition = { ...competition, id: 'c-9' };

  it('writes the club entries as DSV7', () => {
    const text = buildEntryFile(
      meet,
      [
        {
          personId: 'p-1',
          lastName: 'Muster',
          firstName: 'Mia',
          dsvId: '123456',
          sex: 'W',
          year: 2013,
        },
      ],
      [
        { competitionId: 'c-9', personId: 'p-1', eventNo: 2, time: '00:33,50' },
        { competitionId: 'c-9', personId: 'p-1', eventNo: 3, time: '' },
      ],
      {
        name: 'SG Barnstorf',
        dsvClubId: '0',
        stateId: '9',
        contactName: 'Muster, Max',
        contactStreet: 'Weg 1',
        contactZip: '49406',
        contactCity: 'Barnstorf',
        contactMail: 'a@example.org',
      },
      new Date('2026-11-01T12:00:00'),
    );
    const lines = text.split('\r\n');
    expect(lines).toContain('FORMAT: Vereinsmeldeliste;7;');
    expect(lines).toContain('VERANSTALTUNG: Beispielpokal;Beispielstadt;25;HANDZEIT;');
    expect(lines).toContain('WETTKAMPF: 2;E;1;1;50;F;GL;W;;;');
    expect(lines).toContain('PNMELDUNG: Muster, Mia;123456;1;W;2013;;;GER;;;');
    expect(lines).toContain('STARTPN: 1;2;00:00:33,50;');
    expect(lines).toContain('STARTPN: 1;3;00:00:00,00;');
  });

  it('names the file like the DSV exports', () => {
    expect(entryFileName({ ...meet, place: 'Osnabrück' }, 'SG Barnstorf')).toBe(
      '2026-12-05-Osnabrue-SGBarnstorf-Me',
    );
  });
});

describe('times and years', () => {
  it('normalises typed entry times', () => {
    expect(normalizeTime('31,2')).toBe('00:31,20');
    expect(normalizeTime('1:05,85')).toBe('01:05,85');
    expect(normalizeTime('65,85')).toBe('01:05,85');
    expect(normalizeTime('')).toBe('');
    expect(normalizeTime('abc')).toBeNull();
    expect(normalizeTime('75:00')).toBeNull();
  });

  it('checks the birth year against the event', () => {
    expect(yearFits('offen', 2010)).toBe(true);
    expect(yearFits('2012 - 2014', 2013)).toBe(true);
    expect(yearFits('2012 - 2014', 2015)).toBe(false);
    expect(yearFits('2019', 2019)).toBe(true);
    expect(yearFits('2019', 2018)).toBe(false);
  });
});

describe('createZip', () => {
  it('writes a valid single-file archive', () => {
    const data = new TextEncoder().encode('hallo');
    const zip = createZip([{ name: 'a.txt', data }], new Date(2026, 10, 1, 12, 0, 0));
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(data));
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(1);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('parseDsv7 with files from other programs', () => {
  const EASYWK = [
    'FORMAT: Wettkampfdefinitionsliste;7;',
    'VERANSTALTUNG: 8. Hunte-Schwimmmeeting;Diepholz;50;HANDZEIT;',
    'MELDESCHLUSS: 23.05.2026;23:59;',
    'BANKVERBINDUNG: Kreissparkasse;DE39 2915;BRLADE21SYK;',
    '(* KONTOINHABER: Sportgemeinschaft Diepholz e.V.; *)',
    'ABSCHNITT: 1;30.05.2026;09:00;09:20;10:00;;',
    'ABSCHNITT: 2;30.05.2026;00:00;00:30;01:00;J; (* relativ *)',
    'WETTKAMPF: 1;E;1;1;100;B;GL;W;SW;;; (* 100m Brust weiblich *)',
    'WETTKAMPF: 15;E;1;4;50;X;X;X;SW;;; (* 4x50m T-Shirt-Staffel mixed *)',
    'WETTKAMPF: 32;E;2;4;50;F;GL;X;SW;;; (* 200m TeamRace mixed *)',
    'WERTUNG: 1;E;1002;JG;2017;2017;W;Jahrgang 2017;',
    'WERTUNG: 1;E;1010;JG;0;2006;W;Masters (Jg. 2006 und älter);',
    'WERTUNG: 1;E;1011;JG;0;2017;W;Offene Wertung;',
    'WERTUNG: 15;E;15001;JG;0;2018;X;Offene Wertung;',
    'MELDEGELD: Wkmeldegeld;4,00;1;',
    'MELDEGELD: Wkmeldegeld;6,00;15;',
    'MELDEGELD: Wkmeldegeld;0,00;32;',
    'DATEIENDE',
  ].join('\r\n');

  it('reads per-event fees, open lower year limits and the account holder from a comment', () => {
    const { competition, warnings } = parseDsv7(EASYWK);
    expect(competition.bank).toMatchObject({
      holder: 'Sportgemeinschaft Diepholz e.V.',
      bank: 'Kreissparkasse',
      iban: 'DE39 2915',
    });
    expect(competition.events[0]).toMatchObject({ fee: 4, birthYears: 'bis 2017' });
    expect(competition.events[1]).toMatchObject({ fee: 6, count: 4, stroke: 'X' });
    expect(competition.events[1].name).toBe('4x50m T-Shirt-Staffel mixed');
    expect(competition.events[2]).toMatchObject({ fee: 0, count: 4, stroke: 'F' });
    expect(warnings.some((text) => text.includes('Meldegeld'))).toBe(false);
    expect(yearFits('bis 2017', 2012)).toBe(true);
    expect(yearFits('bis 2017', 2018)).toBe(false);
  });

  it('reads files without a space after the key and with empty relay counts (DSV8)', () => {
    const { competition } = parseDsv7(
      'FORMAT:Wettkampfdefinitionsliste;8;\nVERANSTALTUNG:Wesavi;Nienburg;25;HANDZEIT;\nWETTKAMPF:3;E;1;;100;L;GL;W;SW;;;\nWETTKAMPF:1;E;1;4;50;F;GL;W;SW;;;',
    );
    expect(competition.events.map((event) => [event.no, event.count])).toEqual([
      [1, 4],
      [3, 1],
    ]);
  });

  it('writes relay teams into the entry file', () => {
    const { competition } = parseDsv7(EASYWK);
    const text = buildEntryFile(
      { ...competition, id: 'c-8' },
      [],
      [],
      {
        name: 'SG Barnstorf',
        dsvClubId: '3789',
        stateId: '9',
        contactName: 'Muster, Max',
        contactStreet: 'Weg 1',
        contactZip: '49406',
        contactCity: 'Barnstorf',
        contactMail: 'a@example.org',
      },
      new Date(2026, 10, 1),
      [{ competitionId: 'c-8', eventNo: 15, team: 1, year: 2010, time: '', memberIds: ['a'] }],
    );
    expect(text).toContain('STMELDUNG: 1;1001;JG;2010;0;;\r\n');
    expect(text).toContain('STARTST: 1001;15;00:00:00,00;\r\n');
    expect(text.endsWith('DATEIENDE\r\n')).toBe(true);
  });
});
