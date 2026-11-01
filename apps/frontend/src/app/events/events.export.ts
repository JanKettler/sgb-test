import { XlsxBook, XlsxSheet } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import { EventPlan } from './events.models';

function date(iso: string): string {
  return iso ? fullDate(iso) : '';
}

/** The checklist and the helpers of one event. */
export function eventBook(plan: EventPlan): XlsxBook {
  const sheets: XlsxSheet[] = [
    {
      name: 'Checkliste',
      head: ['Erledigt', 'Punkt', 'Kategorie', 'Zuständig', 'Frist', 'Erledigt von'],
      widths: [10, 46, 18, 24, 12, 18],
      formats: ['center', 'text', 'text', 'text', 'date', 'text'],
      rows: plan.checklist.map((point) => [
        point.done ? 'ja' : '',
        point.text,
        point.category,
        point.who.join(', '),
        date(point.due),
        point.doneBy,
      ]),
    },
  ];
  if (plan.helpers.length > 0) {
    sheets.push({
      name: 'Helfer',
      head: ['Name', 'Aufgabe'],
      widths: [28, 36],
      formats: ['text', 'text'],
      rows: plan.helpers.map((helper) => [helper.name, helper.task]),
    });
  }
  const when = [date(plan.date), plan.time ? `${plan.time} Uhr` : ''].filter(Boolean).join(', ');
  return {
    title: plan.title,
    subtitle: [when, plan.place].filter(Boolean).join(' · '),
    sheets,
  };
}

/** A file name without characters that file systems do not like. */
export function eventFilename(plan: EventPlan): string {
  const name = plan.title.replace(/[^\wäöüÄÖÜß-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${name || 'Veranstaltung'}.xlsx`;
}
