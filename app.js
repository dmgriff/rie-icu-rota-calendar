const REPO_OWNER_FALLBACK = "dmgriff";
const REPO_NAME_FALLBACK = "rie-icu-rota-calendar";
const BRANCH = "main";

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};
const MONTH_NAMES = Object.keys(MONTHS).map(m => m[0].toUpperCase() + m.slice(1));

const COLUMNS = [
  "118 base A",
  "118 Base B",
  "116 base C",
  "116 base D",
  "1st on call night",
  "2nd on call night"
];

const els = {
  periodSelect: document.getElementById("periodSelect"),
  nameSelect: document.getElementById("nameSelect"),
  summaryCard: document.getElementById("summaryCard"),
  summaryText: document.getElementById("summaryText"),
  shiftList: document.getElementById("shiftList"),
  rotaCard: document.getElementById("rotaCard"),
  rotaTableWrap: document.getElementById("rotaTableWrap"),
  downloadBtn: document.getElementById("downloadBtn"),
  confirmCheck: document.getElementById("confirmCheck")
};

let rotaPeriods = [];
let selectedPeriod = null;
let selectedName = "";

function repoInfo() {
  const host = window.location.hostname;
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (host.endsWith("github.io") && parts.length > 0) {
    return { owner: host.replace(".github.io", ""), repo: parts[0] };
  }
  return { owner: REPO_OWNER_FALLBACK, repo: REPO_NAME_FALLBACK };
}

async function listDocxFiles() {
  const { owner, repo } = repoInfo();
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/rotas?ref=${BRANCH}`;
  const res = await fetch(api, { headers: { "Accept": "application/vnd.github+json" } });
  if (!res.ok) throw new Error("Could not read the rotas folder. Check that rotas/ exists and contains .docx files.");
  const items = await res.json();
  return items
    .filter(item => item.type === "file" && item.name.toLowerCase().endsWith(".docx"))
    .map(item => ({ name: item.name, url: item.download_url }));
}

async function extractDocxText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url}`);
  const buffer = await res.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

function cleanLines(text) {
  return text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
}

function compactName(x) {
  return String(x || "").trim().replace(/\s+/g, " ");
}

function isNameCell(x) {
  const s = compactName(x);
  if (!s) return false;
  if (/^(118|116|1st|2nd|base|on call|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  return /^[A-Z][A-Z '\-]+$/.test(s) || /^[A-Z]\s+[A-Z][A-Z '\-]+$/.test(s);
}

function dateIso(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRotaText(text, fileName) {
  const lines = cleanLines(text);
  const months = [];
  let i = 0;

  while (i < lines.length) {
    const heading = lines[i].match(/Critical Care Consultant rota\s+([A-Za-z]+)\s+(\d{4})/i);
    if (!heading) { i++; continue; }

    const monthName = heading[1].toLowerCase();
    const year = Number(heading[2]);
    const monthIndex = MONTHS[monthName];
    const monthTitle = `${MONTH_NAMES[monthIndex]} ${year}`;
    const rows = [];
    i++;

    while (i < lines.length && !/Critical Care Consultant rota\s+[A-Za-z]+\s+\d{4}/i.test(lines[i])) {
      const weekday = lines[i];
      if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(weekday) && /^\d{1,2}$/.test(lines[i + 1] || "")) {
        const day = Number(lines[i + 1]);
        const values = [];
        let j = i + 2;
        while (j < lines.length && values.length < COLUMNS.length && !/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(lines[j]) && !/Critical Care Consultant rota\s+[A-Za-z]+\s+\d{4}/i.test(lines[j])) {
          const value = compactName(lines[j]);
          if (isNameCell(value)) values.push(value);
          j++;
        }
        if (values.length >= COLUMNS.length) {
          rows.push({
            date: dateIso(year, monthIndex, day),
            weekday,
            day,
            duties: COLUMNS.map((column, idx) => ({ column, name: values[idx] || "" }))
          });
          i = j;
          continue;
        }
      }
      i++;
    }
    if (rows.length) months.push({ title: monthTitle, year, monthIndex, rows });
  }

  const allRows = months.flatMap(m => m.rows.map(r => ({ ...r, monthTitle: m.title })));
  const names = Array.from(new Set(allRows.flatMap(r => r.duties.map(d => d.name)).filter(Boolean))).sort((a,b) => a.localeCompare(b));
  const label = makePeriodLabel(months, fileName);
  return { fileName, label, months, names };
}

function makePeriodLabel(months, fileName) {
  if (!months.length) return fileName.replace(/\.docx$/i, "");
  const first = months[0];
  const last = months[months.length - 1];
  const start = first.title.split(" ")[0];
  const end = last.title.split(" ")[0];
  const yearText = first.year === last.year ? String(first.year) : `${first.year}-${last.year}`;
  return `${start} - ${end} ${yearText}`;
}

function eventsForName(period, name) {
  const events = [];
  for (const month of period.months) {
    for (const row of month.rows) {
      for (const duty of row.duties) {
        if (duty.name === name) {
          events.push({ date: row.date, weekday: row.weekday, duty: duty.column, name, month: month.title });
        }
      }
    }
  }
  return events;
}

function nextDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0,10).replace(/-/g, "");
}
function yyyymmdd(iso) { return iso.replace(/-/g, ""); }
function stamp() { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function esc(s) { return String(s).replace(/\\/g,"\\\\").replace(/,/g,"\\,").replace(/;/g,"\\;").replace(/\n/g,"\\n"); }

function generateICS(events, periodLabel) {
  const dtstamp = stamp();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN"];
  events.forEach((e, idx) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.date}-${idx}-${e.name.replace(/\s+/g,"-")}@rie-icu-rota`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${yyyymmdd(e.date)}`,
      `DTEND;VALUE=DATE:${nextDate(e.date)}`,
      `SUMMARY:${esc(e.duty)}`,
      `DESCRIPTION:${esc(`${e.duty} — ${e.name}. Source rota: ${periodLabel}`)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadFile(name, text) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderPeriodOptions() {
  els.periodSelect.innerHTML = "";
  rotaPeriods.forEach((p, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = p.label;
    els.periodSelect.appendChild(option);
  });
  els.periodSelect.disabled = rotaPeriods.length === 0;
  if (rotaPeriods.length) selectPeriod(0);
}

function selectPeriod(idx) {
  selectedPeriod = rotaPeriods[idx];
  selectedName = "";
  els.nameSelect.innerHTML = '<option value="">Select your name…</option>';
  selectedPeriod.names.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.nameSelect.appendChild(option);
  });
  els.nameSelect.disabled = false;
  els.summaryCard.hidden = true;
  els.rotaCard.hidden = true;
  els.confirmCheck.checked = false;
  updateDownloadState();
}

function selectName(name) {
  selectedName = name;
  els.confirmCheck.checked = false;
  if (!selectedPeriod || !selectedName) {
    els.summaryCard.hidden = true;
    els.rotaCard.hidden = true;
    return;
  }
  renderSummary();
  renderRotaTable();
  els.summaryCard.hidden = false;
  els.rotaCard.hidden = false;
  updateDownloadState();
}

function renderSummary() {
  const events = eventsForName(selectedPeriod, selectedName);
  els.summaryText.textContent = `${events.length} all-day event${events.length === 1 ? "" : "s"} for ${selectedName} in ${selectedPeriod.label}.`;
  els.shiftList.innerHTML = `<thead><tr><th>Date</th><th>Day</th><th>Duty</th></tr></thead><tbody>${events.map(e => `<tr><td>${formatDate(e.date)}</td><td>${e.weekday}</td><td>${e.duty}</td></tr>`).join("")}</tbody>`;
}

function renderRotaTable() {
  const html = selectedPeriod.months.map(month => {
    const rows = month.rows.map(row => {
      const cells = row.duties.map(d => `<td>${d.name === selectedName ? `<span class="hit">${d.name}</span>` : d.name}</td>`).join("");
      return `<tr><td>${row.weekday}</td><td>${row.day}</td>${cells}</tr>`;
    }).join("");
    return `<div class="rotaMonth"><h3>${month.title}</h3><table><thead><tr><th>Day</th><th>Date</th>${COLUMNS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  els.rotaTableWrap.innerHTML = html;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function updateDownloadState() {
  const events = selectedPeriod && selectedName ? eventsForName(selectedPeriod, selectedName) : [];
  els.downloadBtn.disabled = !(selectedPeriod && selectedName && events.length && els.confirmCheck.checked);
}

els.periodSelect.addEventListener("change", e => selectPeriod(Number(e.target.value)));
els.nameSelect.addEventListener("change", e => selectName(e.target.value));
els.confirmCheck.addEventListener("change", updateDownloadState);
els.downloadBtn.addEventListener("click", () => {
  const events = eventsForName(selectedPeriod, selectedName);
  const ics = generateICS(events, selectedPeriod.label);
  const safe = `${selectedName}-${selectedPeriod.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadFile(`${safe}.ics`, ics);
});

async function init() {
  try {
    const files = await listDocxFiles();
    if (!files.length) throw new Error("No .docx files found in rotas/.");
    const parsed = [];
    for (const file of files) {
      const text = await extractDocxText(file.url);
      const period = parseRotaText(text, file.name);
      if (period.months.length) parsed.push(period);
    }
    if (!parsed.length) throw new Error("No readable rota tables found in the Word files.");
    rotaPeriods = parsed.sort((a, b) => {
      const aa = a.months[0]?.year * 12 + a.months[0]?.monthIndex;
      const bb = b.months[0]?.year * 12 + b.months[0]?.monthIndex;
      return aa - bb;
    });
    renderPeriodOptions();
  } catch (err) {
    els.periodSelect.innerHTML = `<option>${err.message}</option>`;
    document.querySelector(".notice").classList.add("error");
  }
}

init();
