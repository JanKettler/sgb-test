# Intranet pages in the portal

The old club Intranet is replaced page by page. This document lists which pages exist in the
portal, which parts of the Intranet were ported and which were left out on purpose or are still
missing. All pages use in-memory stores with invented sample data; nothing is persisted and no real
person data is used. The demo role switch of the portal (board, trainer, parent) stands in for real
permissions until authentication and the API exist.

## Pages

| Page            | Path               | Folder              | What it covers                                                                                       |
| --------------- | ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Dokumente       | `/dokumente`       | `documents/`        | Club documents as links, grouped by area, with search, add, edit and delete                          |
| Material        | `/material`        | `equipment/`        | Items with stock and minimum, lending and returns, shopping list, badge stock, Excel export          |
| Veranstaltungen | `/veranstaltungen` | `events/`           | Events with checklists and helpers and checklist templates; the dates show on the start page         |
| Vorstand        | `/vorstand`        | `executive-board/`  | Motions, meetings with minutes and numbered outline, resolutions with deadlines, deadline calendar   |
| Jugend          | `/jugend`          | `youth/`            | Swimming badges (records, accounting, prices, requirements) and the youth cash book with expenses    |
| Abrechnung      | `/abrechnung`      | `billing/`          | Trainer hours from the training sessions, drives, rates, status flow, Excel export and print         |
| Weihnachtsmarkt | `/weihnachtsmarkt` | `christmas-market/` | Helper lists, cash desk, accounts, shopping list and stock, punch recipe, setting up and taking down |

Every page has its own routes file, so the pages can be merged and extended independently. The pages
work together where the Intranet did: the billing takes its hours from the training sessions, the
badge prices use the badge stock of the material page, and the profit of the Christmas market is
booked into the youth cash.

## Shared building blocks

- `app-action` (`ui/action.ts`): one button per recurring action (add, edit, view, delete, copy,
  save, cancel, restore, send, back, next, download, print, Excel, lend, return, done, register,
  unregister, and so on; the list is `ACTIONS` in the file). The same action has the same colour,
  icon and accessible name on every page. Icon only by default, with `withText` the name is shown,
  with `link` it is a router link (also with query parameters).
- `app-form-dialog` (`ui/form-dialog.ts`): a dialog that is described by its fields (text, number,
  date, time, select, checkbox, tags, lines). Required fields and an extra check are verified
  before the dialog hands back its values.
- `app-confirm-dialog`, `app-modal-dialog`, `app-tabs`, `app-search-field`, toasts and the shared
  styles in `styles/_ui.scss` (lists, tiles, chips, pills, facts).
- `core/money.ts`: `euro`, `roundCents` and `parseEuro` for all pages (they used to exist three
  times).
- `competition/xlsx.ts`: the one Excel writer. Column widths are never smaller than their heading
  needs (`headWidth`), so no heading wraps. Every new export is covered by a heading-width test.

## Christmas market

The page has six tabs. Everybody sees the notice board; the other tabs are for the organisers
(board and trainers).

- **Aushang**: countdown to the market, the notice, "Meine Schichten", the helper lists of both
  days and the places for the waffle dough. Parents sign up and off themselves and see first names
  only (their own name in full). Organisers put other people on a line, edit, move and delete
  lines, change the number of dough places and export the lists to Excel. The board changes the
  date.
- **Kasse**: one tile per product with big plus and minus buttons, the free items for helpers,
  undo, donations, the cash count (change in the morning, cash in the evening, withdrawals,
  difference) and closing a day. A closed day is locked; only the board can open it again.
- **Abrechnung**: sales per day, fee, expenses, profit, waffles and batches of dough, Excel export.
  The profit can be booked once as income into the youth cash. The board maintains the fee, the
  waffles per batch and the products with their prices.
- **Bestand & Einkauf**: the shopping list by store with what is missing, the packs to buy and the
  cost, and the inventory by category with a status per article. Excel export of the shopping list.
- **Rezept**: the punch recipe scaled to the litres that are needed. The need can be transferred
  into the shopping list after a look at what changes.
- **Aufbau & Abbau**: checklists for setting up and taking down (with a suggestion for taking down)
  and notes for the helpers.

### Left out of the Christmas market

The Intranet page has about 7,100 lines. The portal version covers the core of the work during and
before the market. Not ported:

- cabling plan, boxes with packing lists, the sketch of the stand and the acceptance check
- archive of earlier years and the loan list
- charts, the rights and admin area, status and log pages, the practice mode
- editing the ingredients of the recipe (only the preparation and the note can be edited), images

## Buttons

All pages use `app-action` for adding, editing, viewing, deleting, copying, saving, cancelling,
sending and the other recurring actions, and `app-confirm-dialog` for the question "really
delete?". These stay plain buttons on purpose:

- toggles, filter chips and the choice between options (list or columns, long or short course,
  the tabs of a page, the sign-up states of an attendance row),
- the toolbar of the rich editor and the big sale buttons of the cash desk,
- the waitlist pages, which are older, have their own labelled workflow buttons (for example
  "Zuteilung speichern") and tests that select them by class,
- the print windows of the exports, which are separate HTML documents, and the link that opens the
  mail program.

## Left out in other pages

- The PDF imports of the Intranet are not ported. Print views open the print dialog of the browser.
- The JSON import of the old cash book is not ported.
- Files cannot be uploaded: documents are links and receipts are a flag.
- Signatures cannot be drawn.
- The Excel files are produced by the shared writer and do not use the templates of the Intranet.

## Limits that apply to every page

- All data lives in memory and is lost on reload. The stores are the seam for the later API.
- The portal has no real permissions yet. Pages ask the role of the demo switch.
- The templates are compiled by the CI build; the pages were not looked at in a browser while they
  were written.
