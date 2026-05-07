# RIE ICU rota calendar

A static GitHub Pages site that reads Word rota files from the `rotas/` folder and lets users download their duties as all-day `.ics` calendar events.

## Public URLs

User page:

`https://dmgriff.github.io/rie-icu-rota-calendar/`

Rota upload instructions:

`https://dmgriff.github.io/rie-icu-rota-calendar/admin.html`

## Minimal rota-master workflow

1. Create the official ICU rota as a Word `.docx` file.
2. Open the GitHub repository.
3. Open the `rotas/` folder.
4. Upload the new Word rota file.
5. Commit changes.
6. The public page automatically reads all `.docx` files in `rotas/` and updates the rota-period dropdown.

No `rota-data.js` rebuild is needed.

## Keeping old rotas available

Do not delete older Word files from `rotas/` if you want those periods to remain available.

Example folder contents:

- `RIE ICU APR JUL 26.docx`
- `RIE ICU AUG NOV 26 V1.docx`
- `RIE ICU DEC MAR 27.docx`

The dropdown will then include the months found in those documents, plus an all-period option.

## Overlapping months

If two Word files contain the same month, the app uses the later file alphabetically/upload-order fallback as implemented in the browser parser. Best practice: keep only the current official version for any month.

## Access control

GitHub Pages is static. The secure control is GitHub repository permissions: only nominated rota uploaders should have write access to the repository.

## Calendar behaviour

The `.ics` export uses all-day events, one event per duty. If a person has both a base duty and an on-call duty on the same day, both are exported.

The ICS file is deliberately minimal to encourage import into an existing calendar, but the final behaviour is controlled by Apple Calendar, Google Calendar, Outlook, or the user's device.
