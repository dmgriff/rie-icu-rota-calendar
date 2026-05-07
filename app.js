const OWNER = 'dmgriff';
const REPO = 'rie-icu-rota-calendar';
const BRANCH = 'main';
const ROTA_FOLDER = 'rotas';

const MONTHS={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
let data = { periods: [], rows: [], shifts: [], names: [], files: [] };

const loadingPanel=document.getElementById('loadingPanel');
const mainPanel=document.getElementById('mainPanel');
const errorPanel=document.getElementById('errorPanel');
const loadStatus=document.getElementById('loadStatus');
const errorText=document.getElementById('errorText');
const periodSelect=document.getElementById('periodSelect');
const nameSelect=document.getElementById('nameSelect');
const shiftCount=document.getElementById('shiftCount');
const shiftPreview=document.getElementById('shiftPreview');
const rotaTable=document.getElementById('rotaTable');
const confirmCheck=document.getElementById('confirmCheck');
const downloadBtn=document.getElementById('downloadBtn');

document.addEventListener('DOMContentLoaded', init);

async function init(){
  try{
    if(!window.JSZip) throw new Error('The document parser did not load. Check internet access and refresh.');
    data = await loadAllRotaFiles();
    if(!data.shifts.length) throw new Error('No duties were found in the Word rota files.');
    setupControls();
    loadingPanel.classList.add('hidden');
    mainPanel.classList.remove('hidden');
    render();
  }catch(err){
    console.error(err);
    loadingPanel.classList.add('hidden');
    errorPanel.classList.remove('hidden');
    errorText.textContent = err.message || String(err);
  }
}

async function loadAllRotaFiles(){
  loadStatus.textContent = 'Finding Word rota files in GitHub...';
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ROTA_FOLDER}?ref=${BRANCH}`;
  const res = await fetch(apiUrl, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Could not read GitHub rotas folder. Expected ${OWNER}/${REPO}/${ROTA_FOLDER}.`);
  const items = await res.json();
  const files = items
    .filter(item => item.type === 'file' && /\.docx$/i.test(item.name))
    .sort((a,b)=> new Date(a.git_url ? 0 : 0) - new Date(b.git_url ? 0 : 0) || a.name.localeCompare(b.name));
  if(!files.length) throw new Error('No .docx files found in the rotas folder.');

  const parsed=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    loadStatus.textContent = `Reading rota ${i+1} of ${files.length}: ${file.name}`;
    const fileRes = await fetch(file.download_url + `?v=${Date.now()}`, { cache: 'no-store' });
    if(!fileRes.ok) throw new Error('Could not download '+file.name);
    const buffer = await fileRes.arrayBuffer();
    const d = await parseDocxArrayBuffer(buffer, file.name, i);
    parsed.push(d);
  }
  return combineRotaData(parsed);
}

function setupControls(){
  periodSelect.innerHTML = data.periods.map(p => `<option value="${esc(p.key)}">${esc(p.label)}</option>`).join('');
  populateNames();
  periodSelect.addEventListener('change', () => { populateNames(); render(); });
  nameSelect.addEventListener('change', render);
  confirmCheck.addEventListener('change', updateDownloadState);
  downloadBtn.addEventListener('click', downloadIcs);
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
function downloadIcs(){ const name=nameSelect.value; downloadFile(`${safe(name)}-rie-icu-rota.ics`, buildIcs(selectedShifts(), name), 'text/calendar;charset=utf-8'); }

function buildIcs(shifts, name){
  const stamp = toIcsUtc(new Date());
  const events = shifts.map((s, i) => {
    const start = s.date.replaceAll('-','');
    const end = addOneDayIso(s.date).replaceAll('-','');
    return ['BEGIN:VEVENT',
      `UID:${safe(name)}-${s.date}-${safe(s.column)}-${i}@rie-icu-rota`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEsc('ICU '+s.column)}`,
      'LOCATION:RIE ICU',
      `DESCRIPTION:${icsEsc('Experimental rota calendar export. Check against official rota. Name: '+name+'; duty: '+s.column)}`,
      'END:VEVENT'].join('\r\n');
  }).join('\r\n');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RIE ICU Rota Calendar//EN',events,'END:VCALENDAR'].join('\r\n');
}

async function parseDocxArrayBuffer(arrayBuffer,fileName,fileOrder){
  const zip=await JSZip.loadAsync(arrayBuffer);
  const docfile=zip.file('word/document.xml');
  if(!docfile)throw new Error(`${fileName}: no word/document.xml found.`);
  const xmlText=await docfile.async('text');
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  const body=xml.getElementsByTagNameNS('*','body')[0];
  let current=null;
  const periods=[],rows=[],shifts=[],names=new Set();
  for(const child of [...body.children]){
    if(child.localName==='p'){
      const h=parseHeading(textFromNode(child));
      if(h)current=h;
    }
    if(child.localName==='tbl'&&current){
      const result=parseTable(child,current,fileName,fileOrder);
      if(result.rows.length){
        periods.push(result.period); rows.push(...result.rows); shifts.push(...result.shifts); result.shifts.forEach(s=>names.add(s.name));
      }
    }
  }
  return{generatedFrom:fileName,fileOrder,periods,rows,shifts,names:[...names].sort()};
}

function combineRotaData(dataSets){
  const monthMap=new Map();
  const sources=[];
  for(const data of dataSets){
    sources.push(data.generatedFrom);
    for(const period of data.periods){
      const current = monthMap.get(period.key);
      if(!current || data.fileOrder >= current.fileOrder){
        monthMap.set(period.key,{period,rows:data.rows.filter(r=>r.periodKey===period.key),shifts:data.shifts.filter(s=>s.periodKey===period.key),source:data.generatedFrom,fileOrder:data.fileOrder});
      }
    }
  }
  const months=[...monthMap.values()].sort((a,b)=>a.period.key.localeCompare(b.period.key));
  const periods=months.map(m=>m.period);
  const rows=months.flatMap(m=>m.rows);
  const shifts=months.flatMap(m=>m.shifts);
  const names=[...new Set(shifts.map(s=>s.name).filter(Boolean))].sort();
  const allLabel=periods.length?`${periods[0].label.split(' ')[0]} - ${periods[periods.length-1].label}`:'All rotas';
  return{generatedFrom:sources,periods:[{key:'all',label:allLabel,start:periods[0]?.start||''},...periods],rows,shifts,names};
}

function parseHeading(text){
  const compact=String(text||'').toLowerCase().replace(/\s+/g,'');
  const m=compact.match(/criticalcareconsultantrota([a-z]+)(\d{4})/);
  if(!m)return null;
  const monthIndex=MONTHS[m[1]],year=Number(m[2]);
  if(monthIndex===undefined||!year)return null;
  return{monthIndex,year};
}

function parseTable(tbl,h,fileName,fileOrder){
  const raw=[...tbl.getElementsByTagNameNS('*','tr')].map(r=>[...r.getElementsByTagNameNS('*','tc')].map(c=>clean(textFromNode(c))));
  if(!raw.length)return{rows:[],shifts:[],period:null};
  const headerIndex=raw.findIndex(r=>r.filter(isDutyHeader).length>=2);
  if(headerIndex<0)return{rows:[],shifts:[],period:null};
  const header=raw[headerIndex];
  const dateIndex=findDateColumnIndex(header,raw,headerIndex);
  const dutyCols=header.map((label,index)=>({label:normaliseDuty(label),index})).filter(c=>c.index>dateIndex&&c.label);
  const periodKey=`${h.year}-${String(h.monthIndex+1).padStart(2,'0')}`;
  const periodLabel=`${MONTH_NAMES[h.monthIndex]} ${h.year}`;
  const rows=[],shifts=[];
  for(const r of raw.slice(headerIndex+1)){
    const weekday=r[dateIndex-1]||'';
    const day=Number(r[dateIndex]);
    if(!Number.isInteger(day)||day<1||day>31)continue;
    const iso=`${h.year}-${String(h.monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const row={periodKey,date:iso,weekday,duties:[],source:fileName,fileOrder};
    for(const col of dutyCols){
      const name=cleanName(r[col.index]);
      row.duties.push({column:col.label,name});
      if(name)shifts.push({periodKey,date:iso,weekday,column:col.label,name,source:fileName,fileOrder});
    }
    rows.push(row);
  }
  return{period:{key:periodKey,label:periodLabel,start:`${periodKey}-01`,source:fileName,fileOrder},rows,shifts};
}

function findDateColumnIndex(header,rows,headerIndex){
  for(let i=0;i<header.length;i++){
    const sample=rows.slice(headerIndex+1,headerIndex+8).map(r=>r[i]);
    const numeric=sample.filter(v=>/^\d{1,2}$/.test(String(v||'').trim())).length;
    const prev=i>0&&rows.slice(headerIndex+1,headerIndex+8).filter(r=>/^(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)$/i.test(String(r[i-1]||'').trim())).length>=2;
    if(numeric>=2&&prev)return i;
  }
  return 1;
}

function isDutyHeader(v){return/\b(base|on\s*call|night|116|118)\b/i.test(clean(v));}
function normaliseDuty(v){const t=clean(v).replace(/\b1\s*st\b/i,'1st').replace(/\b2\s*nd\b/i,'2nd');return isDutyHeader(t)?t:'';}
function cleanName(v){const n=clean(v).toUpperCase();return(!n||n==='SERVICE')?'':n;}
function textFromNode(node){return[...node.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(' ').replace(/\s+/g,' ').trim();}
function clean(s){return String(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function addOneDayIso(iso){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function toIcsUtc(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }
function formatDate(iso){ return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icsEsc(s){ return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function safe(s){ return String(s || 'rota').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function downloadFile(filename, content, type){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
