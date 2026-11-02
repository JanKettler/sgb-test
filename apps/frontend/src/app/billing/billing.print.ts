import { escapeHtml } from '../competition/competition-download';
import { euro } from '../core/money';
import { fullDate } from '../training/training-dates';
import { Drive, Profile, Statement, hoursText, sortLines, sumsOf } from './billing.models';

/** Empty rows that the printed statement gets at least, so that the form looks like the paper one. */
const MIN_ROWS = 15;
const DOTS = '. . . . . . . . . . .';

/** Extra styles of the billing forms: the signature row, the bank box and the sums. */
export const BILLING_PRINT_CSS =
  '.sigrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px;gap:30px}' +
  '.sigbox{min-width:260px;text-align:center}.sigbox .line{border-top:1px solid #333;margin-top:34px}' +
  '.r{text-align:right}.lb{width:34%}.big{font-size:13.5px}.box{display:flex;flex-wrap:wrap;gap:10px 24px;' +
  'border:1px solid #888;border-radius:6px;padding:10px 14px;margin:0 0 14px}.box div{min-width:40%}' +
  '.box div.w{min-width:100%}.box span{display:block;font-size:10.5px}.box b{font-size:13.5px}';

function signature(today: string): string {
  return (
    `<div class="sigrow"><div>Barnstorf, ${escapeHtml(fullDate(today))}<br>` +
    '<span class="sub">(Datum)</span></div><div class="sigbox"><div class="line"></div>' +
    '<span class="sub">(Unterschrift)</span></div></div>'
  );
}

function text(value: string | number): string {
  return escapeHtml(String(value));
}

/** The statement on paper: units, hours, kilometres, other costs, total, bank data and signature. */
export function statementHtml(statement: Statement, today: string): string {
  const sums = sumsOf(statement);
  const lines = sortLines(statement.lines);
  const rows = lines.map(
    (line) =>
      `<tr><td class="nowrap">${text(fullDate(line.date))}</td><td>${text(line.time)}</td>` +
      `<td class="r">${text(hoursText(line.minutes / 60))}</td><td>${text(line.group)}</td>` +
      `<td>${text(line.place)}</td></tr>`,
  );
  for (let pad = rows.length; pad < MIN_ROWS; pad++) {
    rows.push('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
  }
  const sumRow = (label: string, middle: string, value: string, note = '') =>
    `<tr><td class="lb">${label}</td><td>${middle || DOTS}${note && ` <span class="sub">${text(note)}</span>`}</td>` +
    `<td class="r">${value || DOTS}</td></tr>`;
  const holder =
    statement.accountHolder && statement.accountHolder !== (statement.name || statement.owner)
      ? ` (Kontoinhaber: ${text(statement.accountHolder)})`
      : '';
  return (
    `<h1>Trainerabrechnung</h1><div class="sub">${text(statement.title)}</div>` +
    `<p><b>Name:</b> ${text(statement.name || statement.owner)}` +
    (statement.edv ? ` &nbsp;&nbsp; <b>ÜL-EDV-Nr.:</b> ${text(statement.edv)}` : '') +
    (statement.license ? ` &nbsp;&nbsp; <b>Lizenz:</b> ${text(statement.license)}` : '') +
    '</p><p>An folgenden Tagen wurden von mir folgende Übungseinheiten geleistet:</p>' +
    '<table><thead><tr><th style="width:17%">Datum</th><th style="width:12%">Zeit</th>' +
    '<th style="width:12%">Anz. Std.</th><th style="width:22%">Gruppe</th><th>Ort</th></tr></thead>' +
    `<tbody>${rows.join('')}</tbody></table>` +
    '<table>' +
    sumRow(
      `<b>Training gesamt:</b> ${text(hoursText(sums.hours))} Std.`,
      `á ${text(euro(statement.rate))}`,
      `<b>${text(euro(sums.pay))}</b>`,
    ) +
    sumRow(
      'PKW',
      statement.km > 0
        ? `${text(String(statement.km).replace('.', ','))} km á ${text(euro(statement.kmRate))}`
        : `km á ${text(euro(statement.kmRate))} . . . . . .`,
      statement.km > 0 ? text(euro(sums.car)) : '',
      statement.carText,
    ) +
    sumRow('Telefon', '', '') +
    sumRow('Porto', '', '') +
    sumRow('Kopien', '', '') +
    sumRow(
      'Sonstiges',
      '',
      statement.extra > 0 ? text(euro(sums.extra)) : '',
      statement.extraText,
    ) +
    `<tr><td colspan="2" class="big"><b>Gesamtbetrag:</b></td><td class="r big"><b>${text(euro(sums.total))}</b></td></tr>` +
    '</table>' +
    `<p>Ich bitte um Überweisung auf mein Konto.</p><p>IBAN: <b>${statement.iban ? text(statement.iban) : '______________________'}</b>; ` +
    `BIC: <b>${statement.bic ? text(statement.bic) : '____________'}</b>${holder}</p>` +
    signature(today)
  );
}

/** The form for the flat fees of the drives to the competition training. */
export function drivesHtml(
  owner: string,
  drives: readonly Drive[],
  profile: Profile,
  today: string,
): string {
  const sorted = [...drives].sort((a, b) => a.date.localeCompare(b.date));
  const sum = sorted.reduce((total, drive) => total + drive.amount, 0);
  const bank = profile.iban
    ? `${text(profile.iban)}${profile.bic ? ` / ${text(profile.bic)}` : ''}`
    : '______________________________';
  return (
    '<h1>Fahrtenformular</h1><div class="sub">Wettkampftraining</div>' +
    `<div class="box"><div><span class="sub">Fahrer/in</span><b>${text(owner)}</b></div>` +
    `<div><span class="sub">Kontoinhaber</span><b>${text(profile.accountHolder || owner)}</b></div>` +
    `<div class="w"><span class="sub">IBAN / BIC</span><b>${bank}</b></div></div>` +
    '<p>Für folgende Fahrten zum Wettkampftraining beantrage ich die Fahrtkostenpauschale ' +
    '(feste Pauschale pro Fahrt, unabhängig von der Entfernung):</p>' +
    '<table><thead><tr><th style="width:5%">Nr.</th><th style="width:20%">Datum</th><th>Bemerkung</th>' +
    '<th style="width:18%">Pauschale</th></tr></thead><tbody>' +
    sorted
      .map(
        (drive, index) =>
          `<tr><td>${index + 1}</td><td class="nowrap">${text(fullDate(drive.date))}</td>` +
          `<td>${text(drive.note)}</td><td class="r">${text(euro(drive.amount))}</td></tr>`,
      )
      .join('') +
    `<tr><td colspan="3" class="big"><b>Summe (${sorted.length} ${sorted.length === 1 ? 'Fahrt' : 'Fahrten'})</b></td>` +
    `<td class="r big"><b>${text(euro(sum))}</b></td></tr></tbody></table>` +
    '<p>Ich bitte um Überweisung auf das oben genannte Konto.</p>' +
    signature(today)
  );
}
