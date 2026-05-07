const data = window.ROTA_DATA || { periods: [], rows: [], shifts: [], names: [] };
const periodSelect = document.getElementById('periodSelect');
const nameSelect = document.getElementById('nameSelect');
const shiftCount = document.getElementById('shiftCount');
const shiftPreview = document.getElementById('shiftPreview');
const rotaTable = document.getElementById('rotaTable');
const confirmCheck = document.getElementById('confirmCheck');
const downloadBtn = document.getElementById('downloadBtn');

init();

function init(){
  periodSelect.innerHTML = data.periods.map(p => `<option value="${esc(p.key)}">${esc(p.label)}</option>`).join('');
  populateNames();
  periodSelect.addEventListener('change', () => { populateNames(); render(); });
  nameSelect.addEventListener('change', render);
  confirmCheck.addEventListener('change', updateDownloadState);
  downloadBtn.addEventListener('click', downloadIcs);
  render();
}

function populateNames(){
  const period = periodSelect.value || 'all';
  const names = [...new Set(data.shifts.filter(s => period === 'all' || s.periodKey === period).map(s => s.name))].sort((a,b)=>a.localeCompare(b));
  nameSelect.innerHTML = '<option value="">Select name...</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  confirmCheck.checked = false;
}

function selectedShifts(){
  const period = periodSelect.value || 'all';
  const name = nameSelect.value;
  if(!name) return [];
  return data.shifts
    .filter(s => (period === 'all' || s.periodKey === period) && s.name === name)
    .sort((a,b)=> a.date.localeCompare(b.date) || a.column.localeCompare(b.column));
}

function selectedRows(){
  const period = periodSelect.value || 'all';
  return data.rows.filter(r => period === 'all' || r.periodKey === period).sort((a,b)=>a.date.localeCompare(b.date));
}

function render(){
  const shifts = selectedShifts();
  const name = nameSelect.value;
  shiftCount.textContent = String(shifts.length);
  confirmCheck.checked = false;
  renderShiftPreview(shifts);
  renderRotaTable(name);
  updateDownloadState();
}

function renderShiftPreview(shifts){
  if(!nameSelect.value){ shiftPreview.innerHTML = '<p class="empty">Select your name to preview shifts.</p>'; return; }
  if(!shifts.length){ shiftPreview.innerHTML = '<p class="empty">No duties found for this name in this range.</p>'; return; }
  shiftPreview.innerHTML = shifts.map(s => `<div class="shift"><div><strong>${formatDate(s.date)}</strong><br><small>${esc(s.weekday)}</small></div><div>${esc(s.column)}</div><div><small>All day</small></div></div>`).join('');
}

function renderRotaTable(name){
  const rows = selectedRows();
  if(!rows.length){ rotaTable.innerHTML = '<p class="empty">No rota rows loaded.</p>'; return; }
  const dutyColumns = [...new Set(rows.flatMap(r => r.duties.map(d => d.column)))];
  let currentPeriod = '';
  let html = '<table class="rotaTable"><thead><tr><th>Day</th><th>Date</th>'+dutyColumns.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr></thead><tbody>';
  for(const row of rows){
    const period = (data.periods.find(p => p.key === row.periodKey) || {}).label || row.periodKey;
    if(period !== currentPeriod){ currentPeriod = period; html += `<tr class="monthRow"><th colspan="${2+dutyColumns.length}">${esc(period)}</th></tr>`; }
    html += `<tr><td>${esc(row.weekday)}</td><td>${formatDate(row.date)}</td>`;
    for(const col of dutyColumns){
      const duty = row.duties.find(d => d.column === col);
      const value = duty ? duty.name : '';
      const isHit = name && value === name;
      html += `<td class="${isHit ? 'hit' : ''}">${esc(value)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  rotaTable.innerHTML = html;
}

function updateDownloadState(){ downloadBtn.disabled = selectedShifts().length === 0 || !confirmCheck.checked; }

function downloadIcs(){
  const shifts = selectedShifts();
  const name = nameSelect.value;
  const ics = buildIcs(shifts, name);
  downloadFile(`${safe(name)}-rie-icu-rota.ics`, ics, 'text/calendar;charset=utf-8');
}

function buildIcs(shifts, name){
  const stamp = toIcsUtc(new Date());

  // Ultra-minimal event import.
  // Deliberately avoids X-WR-CALNAME, METHOD:PUBLISH, VTIMEZONE, LOCATION and DESCRIPTION
  // because Apple Calendar can interpret richer ICS files as a separate calendar.
  // Calendar apps still control the final import behaviour, but this is the most
  // compatible static-file approach for adding events to an existing calendar.
  const events = shifts.map((s, i) => {
    const start = s.date.replaceAll('-','');
    const end = addOneDayIso(s.date).replaceAll('-','');
    return ['BEGIN:VEVENT',
      `UID:${safe(name)}-${s.date}-${safe(s.column)}-${i}@rie-icu-rota`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEsc('ICU '+s.column)}`,
      'END:VEVENT'].join('\r\n');
  }).join('\r\n');

  return ['BEGIN:VCALENDAR','VERSION:2.0',events,'END:VCALENDAR'].join('\r\n');
}

function addOneDayIso(iso){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function toIcsUtc(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }
function formatDate(iso){ return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icsEsc(s){ return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function safe(s){ return String(s || 'rota').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function downloadFile(filename, content, type){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
