# Four-course roster reconciliation — 2026-10-27

- Applied the user's definitive course naming to the four existing active course IDs. No new course was created. Existing archived test courses remain archived.
- Read the newly supplied half-year XLSX without modifying it. Imported its 24 full names and emails into the existing half-year course in a guarded transaction.
- Independently compared all active course rosters against the supplied sources: NATAL 19, annual 2 19, annual 3 18, half-year 24. All 80 exact name/email/course associations match.
- Before/after snapshots confirm all 76 prior student records, 129 attendance rows and 31 shared records (including syllabuses and meeting schedules) remain identical. Private snapshots and source data are ignored under outputs/roster-recovery.
- Production browser: all 24 half-year full names are visible; selecting 2026-11-03 shows the half-year lesson with 24 students. The other three courses retain their respective schedules and rosters.
- Fixed half-year names being classified as annual merely because they contain the Hebrew word for annual. Added unit coverage for classification, certificate task filtering and CSV export, plus desktop/mobile checks for the obligations view and downloaded CSV.
- Local validation: 23 unit/code tests and 56 browser tests (including the four original syllabus PDFs on desktop and mobile).

Browser tests use the isolated test database. Production roster checks use the owner's existing authenticated account; no attendance was generated for real students during this reconciliation.
