export const DOCUMENT_CATEGORIES = [
  'Verein',
  'Mitgliedschaft',
  'Wettkampf',
  'Training',
  'Finanzen',
  'Veranstaltungen',
  'Sonstiges',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** A document of the club that lives somewhere else (homepage, drive); the portal only links it. */
export interface ClubDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  /** https address of the file, or empty when there is none yet. */
  url: string;
  note: string;
}

/** Falls back to "Sonstiges" for a text that is not one of the categories. */
export function categoryOf(text: string): DocumentCategory {
  return DOCUMENT_CATEGORIES.find((category) => category === text) ?? 'Sonstiges';
}
