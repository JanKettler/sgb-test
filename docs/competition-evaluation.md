# Competition evaluation

The yearly evaluation ("Jahresauswertung") of the test portal reproduces the evaluation of the
Intranet (`hub-auswertung.js.njk`): ranking by World Aquatics points, statistics, honours, a sheet
per swimmer and the Excel export `Jahresauswertung_<year>.xlsx`. It is reachable at
`wettkampf/auswertung`.

All data is invented sample data in in-memory stores until the backend exists.

## Data flow

```
CompetitionStore + PeopleStore
        │  evaluation.mapper.ts   (meets, starts, results, members)
        ▼
Evaluation (evaluation.logic.ts)  ◄── EvaluationStore (base times, point lists, groups, fees)
        │  evaluation.blocks.ts   (tables, titles, sums as plain data)
        ├──► app-evaluation-blocks   (screen)
        └──► evaluation.xlsx.ts      (Excel workbook)
```

The screen and the Excel file are both built from the same list of blocks (`evaluation.model.ts`),
so they cannot drift apart. A block is a title, a table, a sum line, a note, or tables side by
side. Cells and rows can be marked "screen only" (buttons, notes); the Excel writer skips them.

## Rules taken over from the Intranet

- **Points:** `floor(1000 × (base time / time)³)` with the World Aquatics base times of the season.
  25 m events do not exist at World Aquatics: distance and time are doubled and the points of the
  50 m event are halved and rounded.
- **Ranking:** per swimmer the best points of every event over both pool lengths (or only short or
  long course); sum, number of events and average. The Excel file has the sheets "Auswertung
  Gesamt", "Auswertung Weiblich" and "Auswertung Männlich".
- **Groups:** swimmers below the configured Masters age (default 25) count as Jugend. Jugend is
  divided by year of birth (default groups or own groups per year); small groups are merged with
  a neighbour (`mergeMax`).
- **Medals:** up to three people in a group get gold, four to five also silver, six and more also
  bronze. The sheets "Pokale und Medaillen" and "Übersicht für JHV" list cups, medals and the top
  three.
- **Statistic:** meets with entry fees (a fee typed by hand wins), judges with a "Zählt" switch,
  places, members and groups ("Mitgliederstatistik", "Veranstaltungsstatistik").
- **Excel layout:** Calibri 11, the same fourteen cell formats, inline strings, no grid lines,
  merged cells and column widths from the longest text. One sheet per swimmer follows the seven
  standard sheets. The Intranet export has no club logo header, so this one has none either.

## Base times and point lists

- **World Aquatics base times** are uploaded as CSV or PDF (`wa-points.ts`). The preview dialog
  shows what was found before it is saved. Without an upload the invented values of
  `wa-sample.ts` are used and the page says so ("Beispielwerte, nicht amtlich").
- **Point lists from WebClub** are optional and read from CSV (`point-list.ts`). Their points are
  added to the ranking next to the points computed from the results in this portal; for every
  event the higher points count.

## Sample data

`competition-sample.ts` adds three invented past meets with results to the competition store so
that the evaluation has something to show. They also appear in the competition list.

## Known limits

- The statistic files of WebClub and the PDF with the jubilees are not imported.
- Point lists can only be read from CSV, not from PDF.
- The World Aquatics PDF reader was only tested with generated text, not with real PDFs.
- Judges are read from the duties of the schedule of a meet.

## Tests

`evaluation.spec.ts` (logic), `wa-points.spec.ts`, `point-list.spec.ts`, `band-text.spec.ts`,
`evaluation.xlsx.spec.ts` (workbook parts and cell formats), `evaluation.season.spec.ts` (the sample
season as a workbook) and `evaluation.store.spec.ts` (store, needs the Angular test bed).
