# RIE ICU rota calendar website

This is a static GitHub Pages website for generating personal `.ics` event-import files from the RIE ICU consultant rota.

## What the public page does

The public page has:

1. A rota range selector, for example **August - November 2026**.
2. A name selector populated from the rota.
3. A list of all shifts that will go into the `.ics` download.
4. A copy of the rota table with the selected name highlighted.
5. A confirmation checkbox.
6. A final **Confirm and add to calendar** button.
7. A disclaimer telling users to check against the official rota.

Every selected duty is exported as a separate all-day event. If someone is listed in two columns on the same day, both duties are included.

The `.ics` file is deliberately generated without a calendar name such as `X-WR-CALNAME` and without `METHOD:PUBLISH`. This encourages Apple Calendar, Outlook, and similar apps to treat the file as an event import so the user can add the duties to an existing calendar rather than creating a separate named rota calendar. The calendar app still controls the exact import workflow.

## How nominated rota upload works

GitHub Pages is a static website. It cannot securely store uploaded files or authenticate uploaders by itself.

The secure control is therefore **GitHub repository write access**:

- only you and/or the rota writer should have permission to edit the repository;
- ordinary users can use the public page but cannot publish a new rota;
- the rota writer updates the published rota by replacing `rota-data.js`.

## Initial setup on GitHub Pages

1. Create a GitHub account, if needed.
2. Create a new public repository, for example `rie-icu-rota-calendar`.
3. Upload these files:
   - `index.html`
   - `style.css`
   - `app.js`
   - `rota-data.js`
   - `admin.html`
   - `admin.js`
   - `README.md`
4. In the repository, go to **Settings → Pages**.
5. Under **Build and deployment**, choose:
   - **Source**: Deploy from a branch
   - **Branch**: main
   - **Folder**: /root
6. Save.
7. GitHub will give you a link like:

```text
https://YOUR-GITHUB-NAME.github.io/rie-icu-rota-calendar/
```

Share that link with consultants.

## Updating the rota later

For the rota writer:

1. Open the site and click **Rota writer upload page** at the bottom.
2. Upload the official `.docx` rota.
3. Click **Download rota-data.js**.
4. Go to the GitHub repository.
5. Open `rota-data.js`.
6. Click the pencil/edit icon.
7. Replace the whole file contents with the new downloaded file contents.
8. Click **Commit changes**.

The live website will update automatically, usually within a minute.

## Important limitation

This does not replace the official rota. The parser is designed for the current RIE ICU rota table structure. Users must check the highlighted rota and their downloaded calendar against the official rota.


## Calendar import behaviour

This version generates an ultra-minimal `.ics` file intended to behave like an event import rather than a named calendar import. It deliberately avoids calendar-name metadata, publishing metadata, timezone blocks and other fields that can encourage Apple Calendar to create a separate calendar.

Important: the final import behaviour is controlled by the user's calendar app. If prompted, users should choose their existing calendar as the destination.
