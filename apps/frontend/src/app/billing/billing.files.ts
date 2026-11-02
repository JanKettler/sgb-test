import { downloadXlsx, printHtml } from '../competition/competition-download';
import { drivesBook, statementBook } from './billing.export';
import { Drive, Profile, Statement } from './billing.models';
import { BILLING_PRINT_CSS, drivesHtml, statementHtml } from './billing.print';

/** Joins words to a file name part: letters and digits stay, everything else becomes an underscore. */
export function fileName(...parts: string[]): string {
  return parts.join('_').replace(/[^\p{L}\p{N}]+/gu, '_');
}

export function downloadStatement(statement: Statement): void {
  const name = fileName(statement.title, statement.name || statement.owner);
  downloadXlsx(`Trainerabrechnung_${name}.xlsx`, statementBook(statement));
}

export function printStatement(statement: Statement, today: string): void {
  printHtml(`Trainerabrechnung ${statement.title}`, statementHtml(statement, today), {
    css: BILLING_PRINT_CSS,
  });
}

/** `part` is the number of the page when the drives are split over several forms. */
export function downloadDrives(
  owner: string,
  drives: readonly Drive[],
  profile: Profile,
  part = 1,
): void {
  const suffix = part > 1 ? `_Seite_${part}` : '';
  downloadXlsx(`Fahrten_${fileName(owner)}${suffix}.xlsx`, drivesBook(owner, drives, profile));
}

export function printDrives(
  owner: string,
  drives: readonly Drive[],
  profile: Profile,
  today: string,
): void {
  printHtml(`Fahrtenformular ${owner}`, drivesHtml(owner, drives, profile, today), {
    css: BILLING_PRINT_CSS,
  });
}
