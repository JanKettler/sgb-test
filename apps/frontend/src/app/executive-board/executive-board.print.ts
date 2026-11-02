import { escapeHtml } from '../competition/competition-download';
import { fullDate } from '../training/training-dates';
import { Meeting, Motion } from './executive-board.models';
import { OutlineItem, parseLetter, parseOutline } from './outline';

function tableHtml(rows: readonly string[][]): string {
  const cell = (tag: string, text: string) => `<${tag}>${escapeHtml(text)}</${tag}>`;
  const [head, ...body] = rows;
  return (
    '<table><thead><tr>' +
    (head ?? []).map((text) => cell('th', text)).join('') +
    '</tr></thead><tbody>' +
    body.map((row) => `<tr>${row.map((text) => cell('td', text)).join('')}</tr>`).join('') +
    '</tbody></table>'
  );
}

function paragraphHtml(text: string): string {
  return `<p>${escapeHtml(text).replaceAll('\n', '<br>')}</p>`;
}

function textOf(item: OutlineItem | undefined): string {
  return item?.kind === 'point' ? item.text : '';
}

/**
 * The motion in the letterhead layout: line 2 and 3 of the header, the heading, the text with
 * salutation and closing, then place, date and the name of who made the motion.
 */
export function motionHtml(motion: Motion): string {
  const items = parseLetter(motion.text);
  const salutation = /^Sehr geehrte/i.test(textOf(items[0]))
    ? ''
    : paragraphHtml('Sehr geehrte Damen und Herren,');
  const closing = /^Mit .*Gr(uß|üß)/i.test(textOf(items.at(-1)))
    ? ''
    : paragraphHtml('Mit sportlichem Gruß');
  const body = items
    .map((item) => (item.kind === 'table' ? tableHtml(item.rows) : paragraphHtml(item.text)))
    .join('');
  return (
    `<h1>${escapeHtml(motion.title)}</h1>` +
    (motion.subtitle ? `<div class="sub">${escapeHtml(motion.subtitle)}</div>` : '') +
    (motion.heading ? `<h2>${escapeHtml(motion.heading)}</h2>` : '') +
    salutation +
    body +
    closing +
    `<p>Barnstorf, ${escapeHtml(motion.date ? fullDate(motion.date) : '')}</p>` +
    `<p>${escapeHtml(motion.author)}</p>`
  );
}

/** The minutes of a meeting with the outline of the agenda. */
export function minutesHtml(meeting: Meeting): string {
  const when = [meeting.date ? fullDate(meeting.date) : '', meeting.time && `${meeting.time} Uhr`]
    .filter(Boolean)
    .join(', ');
  const points = parseOutline(meeting.minutes)
    .map((item) =>
      item.kind === 'table'
        ? tableHtml(item.rows)
        : `<p style="margin:3px 0 3px ${item.level * 22}px"><b>${item.label}</b> ${escapeHtml(item.text)}</p>`,
    )
    .join('');
  return (
    `<h1>Protokoll ${escapeHtml(meeting.title)}</h1>` +
    `<div class="sub">${escapeHtml([when, meeting.place].filter(Boolean).join(' · '))}</div>` +
    (meeting.secretary ? `<p>Protokollführung: ${escapeHtml(meeting.secretary)}</p>` : '') +
    (meeting.attendees ? `<p>Anwesend: ${escapeHtml(meeting.attendees)}</p>` : '') +
    points
  );
}
