# RIE ICU rota calendar

Static GitHub Pages site that reads Word `.docx` rota files directly from the repository and generates all-day `.ics` calendar imports for a selected clinician.

## Normal rota workflow

1. Create the rota as a Word `.docx` file.
2. Upload the `.docx` file to the repository folder: `rotas/`.
3. The website automatically detects all `.docx` files in `rotas/`.
4. Users select the rota period, then their name, check the highlighted rota, and download an `.ics` file.

There is no admin page.

## Website URLs

User page:

```text
https://dmgriff.github.io/rie-icu-rota-calendar/
```

GitHub repository:

```text
https://github.com/dmgriff/rie-icu-rota-calendar
```

## How to upload a new rota file

1. Open the repository:
   `https://github.com/dmgriff/rie-icu-rota-calendar`
2. Open the folder `rotas`.
3. Click **Add file → Upload files**.
4. Upload the new `.docx` rota file.
5. Scroll down and click **Commit changes**.
6. Wait about 1 minute.
7. Refresh the website.

The new rota period should appear in the dropdown.

## How to keep previous rotas

Do not delete old `.docx` files from `rotas/`.

For example:

```text
rotas/RIE-ICU-Apr-Jul-2026.docx
rotas/RIE-ICU-Aug-Nov-2026.docx
rotas/RIE-ICU-Dec-Mar-2027.docx
```

Each file appears as a separate rota period.

## Important limitations

- The tool is experimental.
- Users must check the preview against the official rota before importing.
- The Word rota needs to keep the same broad structure:
  - month headings such as `Critical Care Consultant rota August 2026`
  - weekday row
  - date number
  - duty columns in order:
    - 118 base A
    - 118 Base B
    - 116 base C
    - 116 base D
    - 1st on call night
    - 2nd on call night

## Calendar behaviour

The generated `.ics` file contains separate all-day events for every duty. If someone has more than one duty on the same day, both are included.
