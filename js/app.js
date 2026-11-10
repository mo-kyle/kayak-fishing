// UI layer: renders the overview grid, best-day banner, day detail, chart, fish list and map.
// fmtHM, compass, windName, chopLabel come from engine.js (shared global scope).
const $ = (s) => document.querySelector(s);

// filter: from/to = 'YYYY-MM-DD' or null (= first/last forecast day); start/end = hour 0–24 or null (= sunrise/sunset)
const state = { results: {}, raw: {}, spotId: SPOTS.some((s) => s.id === 'seapoint') ? 'seapoint' : SPOTS[0].id, date: null, filter: { from: null, to: null, start: null, end: null },
  favs: new Set(), area: 'all', showAll: false, moreOpen: false };
let chart = null;
let map = null;

const fmtDay = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-ZA', { ...opts, timeZone: 'UTC' });
};
const dayLabel = (day) => (day.isToday ? 'Today' : fmtDay(day.date, { weekday: 'short' }));
const arrow = (deg) => (deg == null ? '' : `<span class="arrow" style="transform:rotate(${Math.round(deg)}deg)" title="from ${compass(deg)}">↓</span>`);
const r0 = (v) => (v == null ? '–' : Math.round(v));
const r1 = (v) => (v == null ? '–' : v.toFixed(1));
const scoreClass = (s) => Engine.verdictFor(s).key;
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------- load ----------
async function load(force = false) {
  const btn = $('#refresh');
  btn.disabled = true;
  showStatus('Loading wind, waves and sea temperature…');
  let loaded;
  try {
    loaded = await Engine.loadAll(SPOTS, force);
  } catch (e) {
    btn.disabled = false;
    showStatus(`Couldn't load the forecast. Check your connection and try again in a minute. (${e.message})`, true);
    return;
  }
  btn.disabled = false;
  loaded.results.forEach((r) => { state.results[r.spot.id] = r; state.raw[r.spot.id] = r.raw; });
  if (loaded.stale) {
    const t = new Date(loaded.stale).toLocaleString('en-ZA', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    showStatus(`The forecast service isn't answering right now, so this is the forecast saved at ${t}. Tap Refresh in a few minutes.`, true);
  } else hideStatus();
  if (!state.results[state.spotId]) state.spotId = Object.keys(state.results)[0];
  $('#updated').textContent = `Updated ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
  applyFilter();
}

// ---------- trip filter (dates + hours you're free) ----------
const HH = (h) => `${String(h).padStart(2, '0')}:00`;
const allDates = () => (Object.values(state.results)[0]?.days || []).map((d) => d.date);
const inDates = (date) => (!state.filter.from || date >= state.filter.from) && (!state.filter.to || date <= state.filter.to);
const visibleDays = (r) => r.days.filter((d) => inDates(d.date));
const filterActive = () => Object.values(state.filter).some((v) => v != null);
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

function normaliseFilter() {
  const f = state.filter, dates = allDates();
  if (f.from && !dates.includes(f.from)) f.from = null;
  if (f.to && !dates.includes(f.to)) f.to = null;
  if (f.from && f.to && f.from > f.to) [f.from, f.to] = [f.to, f.from];
  if (f.start != null && f.end != null && f.end <= f.start) f.end = Math.min(24, f.start + 1);
}

/** Re-score every spot for the chosen hours (no refetch), then redraw. */
function applyFilter() {
  normaliseFilter();
  const opts = {};
  if (state.filter.start != null) opts.start = state.filter.start;
  if (state.filter.end != null) opts.end = state.filter.end;
  SPOTS.forEach((s) => {
    const raw = state.raw[s.id];
    if (raw) state.results[s.id] = Object.assign(Engine.analyseSpot(s, raw.w, raw.m, opts), { raw });
  });
  const days = visibleDays(state.results[state.spotId]);
  if (!state.date || !days.find((d) => d.date === state.date)) state.date = days[0]?.date;
  writeURL();
  render();
}

function readURL() {
  const p = new URLSearchParams(location.search);
  const date = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(p.get(k) || '') ? p.get(k) : null);
  const hour = (k) => { const n = parseInt(p.get(k), 10); return Number.isInteger(n) && n >= 0 && n <= 24 ? n : null; };
  state.filter = { from: date('from'), to: date('to'), start: hour('start'), end: hour('end') };
}
function writeURL() {
  const p = new URLSearchParams();
  Object.entries(state.filter).forEach(([k, v]) => { if (v != null) p.set(k, v); });
  const qs = p.toString();
  try { history.replaceState(null, '', qs ? `?${qs}` : location.pathname); } catch (_) { /* ignore */ }
}

function renderFilter() {
  const f = state.filter, dates = allDates();
  const dateLabel = (d, i) => (i === 0 && d === Engine.todayStr() ? `Today, ${fmtDay(d, { day: 'numeric', month: 'short' })}` : fmtDay(d));
  const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${label}</option>`;
  const from = f.from || dates[0], to = f.to || dates.at(-1);
  $('#fFrom').innerHTML = dates.map((d, i) => opt(d, dateLabel(d, i), d === from)).join('');
  $('#fTo').innerHTML = dates.map((d, i) => opt(d, dateLabel(d, i), d === to)).join('');
  const hours = Array.from({ length: 19 }, (_, i) => i + 4); // 04:00 … 22:00
  $('#fStart').innerHTML = opt('', 'Sunrise', f.start == null) + hours.slice(0, -1).map((h) => opt(h, HH(h), h === f.start)).join('');
  $('#fEnd').innerHTML = opt('', 'Sunset', f.end == null) + hours.slice(1).map((h) => opt(h, HH(h), h === f.end)).join('');

  const n = dates.filter(inDates).length;
  const range = from === to ? fmtDay(from, { weekday: 'long', day: 'numeric', month: 'short' }) : `${fmtDay(from)} – ${fmtDay(to)}`;
  const hrs = f.start == null && f.end == null ? 'sunrise to sunset' : `${f.start == null ? 'sunrise' : HH(f.start)} to ${f.end == null ? 'sunset' : HH(f.end)}`;
  $('#tripNote').textContent = filterActive() ? `${range}, ${hrs}` : `Next ${n} days, ${hrs}`;
  $('#filterBtn').classList.toggle('active', filterActive());
  document.querySelectorAll('.chip[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === presetMatch()));
}

function presetMatch() {
  const f = state.filter;
  if (!filterActive()) return 'all';
  if (f.start === 5 && f.end === 10 && !f.from && !f.to) return 'morning';
  if (f.start === 16 && f.end === 20 && !f.from && !f.to) return 'evening';
  return null;
}

function applyPreset(name) {
  const dates = allDates();
  if (name === 'all') state.filter = { from: null, to: null, start: null, end: null };
  if (name === 'morning') Object.assign(state.filter, { from: null, to: null, start: 5, end: 10 });
  if (name === 'evening') Object.assign(state.filter, { from: null, to: null, start: 16, end: 20 });
  if (name === 'weekend') {
    const i = dates.findIndex((d) => [0, 6].includes(weekday(d)));
    if (i === -1) { $('#tripNote').textContent = 'No weekend days in the 7-day forecast yet.'; return; }
    const sat = weekday(dates[i]) === 6;
    Object.assign(state.filter, { from: dates[i], to: sat && dates[i + 1] ? dates[i + 1] : dates[i] });
  }
  applyFilter();
}

async function shareLink() {
  writeURL();
  const url = location.href;
  const text = filterActive() ? `Kayak fishing forecast: ${$('#tripNote').textContent}` : 'Kayak fishing forecast for the week';
  try {
    if (navigator.share) { await navigator.share({ title: 'Kayak Fishing Planner', text, url }); return; }
    await navigator.clipboard.writeText(url);
    $('#tripNote').textContent = 'Link copied. Paste it into WhatsApp and it opens with these dates and hours.';
  } catch (_) { /* share sheet closed, or clipboard blocked */ }
}

function wireFilter() {
  const num = (v) => (v === '' ? null : parseInt(v, 10));
  $('#fFrom').addEventListener('change', (e) => { state.filter.from = e.target.value; if (state.filter.to && state.filter.to < e.target.value) state.filter.to = e.target.value; applyFilter(); });
  $('#fTo').addEventListener('change', (e) => { state.filter.to = e.target.value; if (state.filter.from && state.filter.from > e.target.value) state.filter.from = e.target.value; applyFilter(); });
  $('#fStart').addEventListener('change', (e) => { state.filter.start = num(e.target.value); applyFilter(); });
  $('#fEnd').addEventListener('change', (e) => { state.filter.end = num(e.target.value); applyFilter(); });
  document.querySelectorAll('.chip[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  $('#share').addEventListener('click', shareLink);
}

function showStatus(msg, err) { const el = $('#status'); el.hidden = false; el.textContent = msg; el.classList.toggle('error', !!err); }
function hideStatus() { $('#status').hidden = true; }

function select(spotId, date, scroll) {
  state.spotId = spotId;
  if (date) state.date = date;
  render();
  if (scroll) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function render() {
  renderFilter();
  renderBest();
  renderPlan();
  if ($('#gridBox').open) renderOverview();
  renderDetail();
  renderMap();
}

// ---------- small building blocks ----------
const ICON = {
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  temp: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  pin: '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};
const icon = (n, cls = '') => `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const areaOf = (sp) => sp.side.split(' (')[0];
const AREAS = [...new Set(SPOTS.map(areaOf))];
const areaShort = (a) => (a === 'Atlantic Seaboard' ? 'Atlantic' : a);
const longDay = (d) => (d.isToday ? `Today, ${fmtDay(d.date, { day: 'numeric', month: 'short' })}` : fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' }));
const listJoin = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
const win = (d) => `<span class="nowrap">${fmtHM(d.best.start)}–${fmtHM(d.best.end)}</span>`;
const badge = (d) => `<div class="score-badge ${d.verdict.key}" aria-label="Score ${d.overall}, ${d.verdict.label}"><b class="tnum">${d.overall}</b><span>${d.verdict.short}</span></div>`;
const scoreBox = (d) => `<span class="score-box ${d.verdict.key} tnum" aria-label="Score ${d.overall}">${d.overall}</span>`;
const fact = (ic, k, v, sub) => `<div class="fact">${icon(ic)}<div><div class="fk">${k}</div><div class="fv tnum">${v}</div>${sub ? `<div class="fs">${sub}</div>` : ''}</div></div>`;

// ---------- my spots (starred, saved on this device) ----------
function loadFavs() { try { return new Set(JSON.parse(localStorage.getItem('kf:favs') || '[]')); } catch (_) { return new Set(); } }
function toggleFav(id) {
  state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
  try { localStorage.setItem('kf:favs', JSON.stringify([...state.favs])); } catch (_) { /* ignore */ }
  if (state.area === 'fav' && !state.favs.size) state.area = 'all';
  render();
}
function areaSpots() {
  if (state.area === 'fav') return SPOTS.filter((s) => state.favs.has(s.id));
  if (state.area === 'all') return SPOTS;
  return SPOTS.filter((s) => areaOf(s) === state.area);
}

// ---------- best bet ----------
function renderBest() {
  const el = $('#best');
  const all = [];
  Object.values(state.results).forEach((r) => visibleDays(r).forEach((d) => { if (!d.dayOver) all.push({ spot: r.spot, day: d }); }));
  all.sort((a, b) => b.day.overall - a.day.overall);
  const top = all[0];
  const scope = filterActive() ? 'in your time' : 'this week';
  if (!top || top.day.overall < 60) {
    el.className = 'best-wrap solo';
    el.innerHTML = `<div class="card best-card none"><p class="eyebrow">Best bet ${scope}</p>
      <h2 class="best-name">${filterActive() ? 'Nothing good in your time' : 'No standout days yet'}</h2>
      <p class="muted">${filterActive() ? 'No spot scores "Good" or better on those days and hours. Try other days or wider hours.' : 'Nothing scores "Good" or better this week. Forecasts change, so check back in a day or two.'}</p></div>`;
    return;
  }
  const d = top.day, s = d.stats;
  const seen = new Set([top.spot.id]);
  const others = [];
  for (const x of all.slice(1)) {
    if (x.day.overall < 60 || others.length === 3) break;
    if (seen.has(x.spot.id)) continue;
    seen.add(x.spot.id);
    others.push(x);
  }
  const fish = d.species.filter((f) => f.likelihood >= 0.45).slice(0, 3).map((f) => f.name);
  el.className = `best-wrap${others.length ? '' : ' solo'}`;
  el.innerHTML = `
    <article class="card best-card">
      <div class="best-top">
        <div>
          <p class="eyebrow">Best bet ${scope}</p>
          <h2 class="best-name">${top.spot.name}</h2>
          <p class="best-when">${longDay(d)} · <b>${win(d)}</b></p>
        </div>
        ${badge(d)}
      </div>
      <div class="facts">
        ${fact('wind', 'Wind', `${r0(s.winWind)} kn`, `gusts ${r0(s.winGust)}`)}
        ${fact('waves', 'Waves', `${r1(s.winWave)} m`, chopLabel(s.winChop ?? 0).toLowerCase())}
        ${fact('temp', 'Water', `${r0(s.sst)} °C`, '')}
      </div>
      ${fish.length ? `<p class="best-fish">${icon('fish')}<span>${listJoin(fish)} ${fish.length > 1 ? 'are' : 'is'} likely</span></p>` : ''}
      <button type="button" class="btn wide" data-go="${top.spot.id}|${d.date}">See the plan</button>
    </article>
    ${others.length ? `<div class="card also"><h3>Also good</h3><ul class="rows">${others.map((o) => `<li><button type="button" class="row" data-go="${o.spot.id}|${o.day.date}">${scoreBox(o.day)}<span class="row-main"><b>${o.spot.name}</b><span>${dayLabel(o.day)} · ${win(o.day)}</span></span>${icon('chev', 'chev')}</button></li>`).join('')}</ul></div>` : ''}`;
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const [id, date] = b.dataset.go.split('|'); select(id, date, true); }));
}

// ---------- pick a day: day strip + ranked spots ----------
const LIMIT = 5;
function renderPlan() {
  const results = SPOTS.map((s) => state.results[s.id]).filter(Boolean);
  const dates = visibleDays(results[0]).map((d) => d.date);
  const pool = areaSpots().map((s) => state.results[s.id]).filter(Boolean);
  const dayOf = (r, dt) => r.days.find((x) => x.date === dt);

  const days = $('#days');
  days.style.gridTemplateColumns = `repeat(${dates.length}, minmax(0, 1fr))`;
  days.innerHTML = dates.map((dt) => {
    const scores = (pool.length ? pool : results).map((r) => dayOf(r, dt)).filter(Boolean).map((d) => d.overall);
    const top = Math.max(...scores);
    const on = dt === state.date;
    return `<button type="button" class="day${on ? ' on' : ''}" data-date="${dt}" aria-pressed="${on}" aria-label="${fmtDay(dt, { weekday: 'long', day: 'numeric', month: 'long' })}, best spot scores ${top}">
      <span class="dw">${dt === Engine.todayStr() ? 'Today' : fmtDay(dt, { weekday: 'short' })}</span><span class="dn tnum">${parseInt(dt.slice(8), 10)}</span><i class="dot ${Engine.verdictFor(top).key}"></i></button>`;
  }).join('');

  const ranked = pool.map((r) => ({ spot: r.spot, d: dayOf(r, state.date) })).filter((x) => x.d).sort((a, b) => b.d.overall - a.d.overall);
  const n = ranked.length, good = ranked.filter((x) => x.d.overall >= 60).length;
  const isToday = state.date === Engine.todayStr();
  $('#dayTitle').textContent = isToday ? `Today, ${fmtDay(state.date, { day: 'numeric', month: 'short' })}` : fmtDay(state.date, { weekday: 'long', day: 'numeric', month: 'short' });
  let sum;
  if (!n) sum = 'Tap the star on any spot to keep it here.';
  else if (n === 1) sum = `${ranked[0].spot.name} ${good ? 'looks good' : 'doesn\'t look good'}.`;
  else sum = good === 0 ? `None of these ${n} spots look good.` : good === n ? `All ${n} spots look good.` : `${good} of ${n} spots look good.`;
  const t = ranked[0]?.d;
  if (t && good) {
    const st = t.stats;
    if (t.dayOver) sum += ' Most of today\'s daylight is gone.';
    else if (st.arvoWind != null && st.morningWind != null && st.arvoWind - st.morningWind >= 6 && st.arvoWind >= 12) sum += ' Go early, the wind picks up in the afternoon.';
    else if (st.windAvg <= 8) sum += ' Light wind most of the day.';
  }
  $('#daySummary').textContent = sum;

  const chips = [['all', 'All'], ['fav', `${icon('star', 'star-ic')}My spots`], ...AREAS.map((a) => [a, areaShort(a)])];
  $('#areas').innerHTML = chips.map(([k, l]) => `<button type="button" class="chip${state.area === k ? ' on' : ''}" data-area="${k}" aria-pressed="${state.area === k}">${l}</button>`).join('');

  const mixed = state.area === 'all' || state.area === 'fav';
  const shown = state.showAll ? ranked : ranked.slice(0, LIMIT);
  $('#ranked').innerHTML = shown.map(({ spot, d }) => `<li><button type="button" class="row${spot.id === state.spotId ? ' sel' : ''}" data-spot="${spot.id}">
      ${scoreBox(d)}
      <span class="row-main"><b>${spot.name}${state.favs.has(spot.id) ? icon('star', 'star-ic on') : ''}${mixed ? `<small>${areaShort(areaOf(spot))}</small>` : ''}</b>
      <span>${win(d)} · ${r0(d.stats.winWind)} kn · ${r1(d.stats.winWave)} m</span></span>
      ${icon('chev', 'chev')}</button></li>`).join('');
  const rest = n - LIMIT, more = $('#moreSpots');
  more.hidden = rest <= 0;
  more.textContent = state.showAll ? 'Show fewer' : `Show ${rest} more spot${rest === 1 ? '' : 's'}`;
}

function wirePlan() {
  $('#days').addEventListener('click', (e) => { const b = e.target.closest('[data-date]'); if (b) { state.date = b.dataset.date; render(); } });
  $('#areas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    state.area = b.dataset.area; state.showAll = false;
    try { localStorage.setItem('kf:area', state.area); } catch (_) { /* ignore */ }
    render();
  });
  $('#ranked').addEventListener('click', (e) => { const b = e.target.closest('[data-spot]'); if (b) select(b.dataset.spot, null, true); });
  $('#moreSpots').addEventListener('click', () => { state.showAll = !state.showAll; renderPlan(); });
  $('#filterBtn').addEventListener('click', () => {
    const p = $('#trip');
    p.hidden = !p.hidden;
    $('#filterBtn').setAttribute('aria-expanded', String(!p.hidden));
  });
  $('#gridBox').addEventListener('toggle', () => { if ($('#gridBox').open) renderOverview(); });
}

// ---------- overview grid (tucked away under "Compare every spot") ----------
function renderOverview() {
  const results = SPOTS.map((s) => state.results[s.id]).filter(Boolean);
  if (!results.length) return;
  const dates = visibleDays(results[0]).map((d) => d.date);
  const head = `<tr><th></th>${dates.map((dt) => `<th>${dt === Engine.todayStr() ? 'Today' : fmtDay(dt, { weekday: 'short' })}<br><span class="muted">${fmtDay(dt, { day: 'numeric', month: 'short' })}</span></th>`).join('')}</tr>`;
  // Area heading row whenever the area changes (West Coast, Atlantic Seaboard, False Bay, ...)
  let lastArea = null;
  const groupRow = (r) => {
    const area = areaOf(r.spot);
    if (area === lastArea) return '';
    lastArea = area;
    return `<tr class="group"><th colspan="${dates.length + 1}" scope="colgroup"><span>${area}</span></th></tr>`;
  };
  // Long single-word names get a short form on phones (e.g. Melkbosstrand -> Melkbos).
  const spotName = (sp) => (sp.short ? `<span class="nm-full">${sp.name}</span><span class="nm-short">${sp.short}</span>` : sp.name);
  const spotSub = (sp) => { const m = sp.side.match(/\((.+)\)/); return m ? `<span>${m[1]}</span>` : ''; };
  const rows = results.map((r) => groupRow(r) + `<tr><th class="spot">${spotName(r.spot)}${spotSub(r.spot)}</th>${dates.map((dt) => {
    const d = r.days.find((x) => x.date === dt);
    if (!d) return '<td></td>';
    const sel = r.spot.id === state.spotId && dt === state.date ? ' sel' : '';
    return `<td><button class="cell ${d.verdict.key}${sel}" data-spot="${r.spot.id}" data-date="${dt}" aria-label="${r.spot.name} ${fmtDay(dt)}: ${d.verdict.label}, score ${d.overall}">
      <span class="score tnum">${d.overall}</span>
      <span class="tiny tnum" title="Wind / gusts during the best window">💨 ${r0(d.stats.winWind)} g${r0(d.stats.winGust)} kn</span>
      <span class="tiny tnum">🌊 ${r1(d.stats.winWave)} m</span>
      <span class="tiny tnum">⏰ ${fmtHM(d.best.start)}</span>
    </button></td>`;
  }).join('')}</tr>`).join('');
  const t = $('#overview');
  t.innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
  t.querySelectorAll('.cell').forEach((b) => b.addEventListener('click', () => select(b.dataset.spot, b.dataset.date, true)));
}

// ---------- spot detail ----------
function renderDetail() {
  const r = state.results[state.spotId];
  const spot = r.spot;
  const days = visibleDays(r);
  const d = days.find((x) => x.date === state.date) || days[0];
  const s = d.stats;
  const fav = state.favs.has(spot.id);
  const f = state.filter;
  const nowH = Engine.nowHour();
  const busy = (h) => (f.start != null && h.hour < f.start) || (f.end != null && h.hour >= f.end); // outside your free hours
  const sub = spot.side.match(/\((.+)\)/)?.[1];
  const idx = days.indexOf(d);

  // The window, in words
  const calm = s.winWind <= 4 ? 'Almost no wind' : s.winWind <= 8 ? 'Light wind' : s.winWind <= 13 ? 'Moderate wind' : 'Windy';
  const winLine = `${calm}${s.winWind > 4 ? ` from the ${compass(s.winDir)}` : ''}, ${chopLabel(s.winChop ?? 0).toLowerCase()} water. Launch: ${spot.launch}.`;
  // One warning only: the most serious thing to know
  const warn = d.reasons.find((x) => x.type === 'bad') || d.reasons.find((x) => x.type === 'ok' && !/^Moderate wind|^Swell around|^Current/.test(x.text));

  // The day as a strip of coloured hours (sunrise to sunset)
  const tl = d.hours.filter((h) => h.hour >= Math.floor(s.sunrise) && h.hour < Math.ceil(s.sunset));
  const runs = [];
  tl.forEach((h) => { const k = Engine.verdictFor(h.score).short; const last = runs.at(-1); if (last && last.k === k) last.to = h.hour + 1; else runs.push({ k, from: h.hour, to: h.hour + 1 }); });
  const tlLabel = runs.map((x) => `${x.k} ${HH(x.from)}–${HH(x.to)}`).join(', ');
  const ticks = tl.length ? [0, 1 / 3, 2 / 3, 1].map((p) => tl[Math.round(p * (tl.length - 1))].hour + (p === 1 ? 1 : 0)) : [];
  const bar = tl.map((h) => {
    const inWin = h.hour >= d.best.start && h.hour < d.best.end;
    const dim = busy(h) || (d.isToday && h.hour < nowH);
    return `<span class="tl ${scoreClass(h.score)}${inWin ? ' win' : ''}${dim ? ' dim' : ''}" title="${HH(h.hour)}: score ${h.score}"></span>`;
  }).join('');

  const tide = d.tideInWindow || d.tides[0];
  const likely = d.species.filter((x) => x.likelihood >= 0.45).slice(0, 5);
  const maybe = d.species.filter((x) => x.likelihood >= 0.2 && x.likelihood < 0.45).slice(0, 3);
  const closed = d.species.filter((x) => x.closed && x.season > 0);
  const chips = [
    ...likely.map((x) => `<span class="fchip">${x.name}</span>`),
    ...maybe.map((x) => `<span class="fchip maybe">${x.name}, maybe</span>`),
    ...closed.map((x) => `<span class="fchip closed">${x.name}: closed season</span>`),
  ].join('') || '<span class="muted small">Nothing much in season here right now.</span>';

  // ----- the detail that used to be on screen, now behind "more" -----
  const moonTxt = d.moon.nearest <= 0.75 ? 'Today' : d.moon.toFull < d.moon.toNew ? `Full in ${Math.round(d.moon.toFull)} d` : `New in ${Math.round(d.moon.toNew)} d`;
  const tideTxt = d.tides.length ? d.tides.map((t) => `${t.type} ${fmtHM(t.hour)}`).join(' · ') : 'n/a';
  const stats = [
    [f.start != null || f.end != null ? 'Wind (your hours)' : 'Wind (daylight)', `${arrow(s.windDir)} ${r0(s.windAvg)} kn`, `${compass(s.windDir)} · max ${r0(s.windMax)} kn`],
    ['Gusts', `${r0(s.gustMax)} kn`, s.gustMax >= 25 ? '<span class="warn">Dangerous</span>' : s.gustMax >= 18 ? 'Strong' : 'Manageable'],
    ['Waves', `${r1(s.waveAvg)} m`, `max ${r1(s.waveMax)} m · ${r0(s.waveT)} s`],
    ['Swell', `${r1(s.swellH)} m`, `${compass(s.swellDir)} · ${r0(s.swellT)} s period`],
    ['Choppiness', `${r1(s.chopAvg)}/10`, chopLabel(s.chopAvg ?? 0)],
    ['Sea temp', `${r1(s.sst)} °C`, s.sstChange == null ? '' : `${s.sstChange >= 0 ? '+' : ''}${s.sstChange.toFixed(1)} °C vs yesterday`],
    ['Air temp', `${r0(s.tempMin)}–${r0(s.tempMax)} °C`, `UV ${r0(s.uv)}`],
    ['Rain', `${r0(s.rainProbMax)}%`, `${r1(s.rainSum)} mm total`],
    ['Sun', `${fmtHM(s.sunrise)}`, `sets ${fmtHM(s.sunset)}`],
    ['Moon', `${d.moon.emoji} ${Math.round(d.moon.fraction * 100)}%`, `${d.moon.name} · ${moonTxt}`],
    ['Tides (est.)', `<span style="font-size:.9rem">${tideTxt}</span>`, d.moon.spring ? 'Spring tides (big range)' : 'Neap-ish'],
    ['Pressure', `${r0(s.pressure)} hPa`, s.pressureChange == null ? '' : `${s.pressureChange >= 0 ? '+' : ''}${s.pressureChange.toFixed(1)} vs yesterday`],
  ].map(([k, v, dd]) => `<div class="stat"><div class="k">${k}</div><div class="v tnum">${v}</div><div class="d">${dd}</div></div>`).join('');

  const rows = d.hours.filter((h) => h.hour >= 4 && h.hour <= 21).map((h) => {
    const night = h.hour < Math.floor(s.sunrise) || h.hour >= Math.ceil(s.sunset);
    const inWin = h.hour >= d.best.start && h.hour < d.best.end;
    const past = d.isToday && h.hour < nowH;
    return `<tr class="${night || past || busy(h) ? 'night' : ''}${inWin ? ' inwin' : ''}">
      <td class="tnum">${HH(h.hour)}${inWin ? ' ⭐' : ''}</td>
      <td class="tnum">${arrow(h.windDir)} ${r0(h.wind)} kn ${compass(h.windDir)}${h.offshore && h.wind > 8 ? ' <span class="warn" title="Offshore wind">⚠ offshore</span>' : ''}</td>
      <td class="tnum${h.gust >= 25 ? ' warn' : ''}">${r0(h.gust)}</td>
      <td class="tnum">${r1(h.waveH)} m · ${r0(h.waveT)} s</td>
      <td class="tnum">${r1(h.chop)} <span class="muted">${chopLabel(h.chop)}</span></td>
      <td class="tnum">${r0(h.rainProb)}%</td>
      <td class="tnum">${r0(h.temp)}°</td>
      <td><span class="sc ${scoreClass(h.score)} tnum">${h.score}</span></td>
    </tr>`;
  }).join('');

  const month = parseInt(d.date.slice(5, 7), 10);
  const fishCard = (x) => `<div class="fish${x.likelihood < 0.2 ? ' dim' : ''}">
    <div class="fish-top"><h3>${x.name}</h3><span class="badge ${x.label.split(' ')[0]}">${x.label}</span></div>
    <div class="latin">${x.latin} · likes ${x.temp[0]}–${x.temp[1]} °C</div>
    <div class="months" title="Season: light = present, dark = peak">${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<i class="${x.peak.includes(m) ? 'pk' : x.present.includes(m) ? 'p' : ''}${m === month ? ' now' : ''}"></i>`).join('')}</div>
    <div class="meth">${x.method}</div>
    ${x.note ? `<div class="small muted">${x.note}</div>` : ''}
    ${x.closed ? `<div class="small warn">${FISH[x.id].closed.label}</div>` : ''}
  </div>`;
  const onFish = d.species.filter((x) => x.likelihood >= 0.2 || x.closed);
  const offFish = d.species.filter((x) => !(x.likelihood >= 0.2 || x.closed));

  const spotOptions = AREAS.map((a) => `<optgroup label="${a}">${SPOTS.filter((x) => areaOf(x) === a && state.results[x.id]).map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</optgroup>`).join('');

  $('#detail').innerHTML = `
    <div class="card spot-card">
      <div class="spot-tools">
        <label class="pick">${icon('pin')}<select id="spotPick" aria-label="Change spot"><option value="" selected disabled hidden>Change spot</option>${spotOptions}</select></label>
        <button type="button" id="favBtn" class="chip fav${fav ? ' on' : ''}" aria-pressed="${fav}" title="${fav ? 'Remove from my spots' : 'Add to my spots'}">${icon('star', 'star-ic')}${fav ? 'Saved' : 'Save spot'}</button>
      </div>

      <div class="spot-head">
        <div class="spot-id">
          <p class="eyebrow">${areaOf(spot)}${sub ? ` · ${sub}` : ''}</p>
          <h2 class="spot-name">${spot.name}</h2>
          <div class="day-step">
            <button type="button" data-step="-1" aria-label="Previous day"${idx <= 0 ? ' disabled' : ''}>${icon('back')}</button>
            <span>${longDay(d)}</span>
            <button type="button" data-step="1" aria-label="Next day"${idx >= days.length - 1 ? ' disabled' : ''}>${icon('chev')}</button>
          </div>
        </div>
        ${badge(d)}
      </div>

      <div class="window-card ${d.verdict.key}">
        <span class="wl">${d.dayOver ? 'Today\'s best window has passed. It was' : d.overall < 45 ? 'Least bad time, if you must' : 'Be on the water'}</span>
        <span class="wt tnum">${fmtHM(d.best.start)} – ${fmtHM(d.best.end)}</span>
        <span class="ws">${winLine}</span>
      </div>

      ${warn ? `<div class="callout ${warn.type}" role="note">${icon('alert')}<span>${warn.text}</span></div>` : ''}

      <div class="dayline">
        <h3>How the day goes</h3>
        <div class="tl-bar" role="img" aria-label="${tlLabel}" style="grid-template-columns:repeat(${tl.length || 1}, minmax(0, 1fr))">${bar}</div>
        <div class="tl-ticks" aria-hidden="true">${ticks.map((h) => `<span>${HH(h)}</span>`).join('')}</div>
        <div class="tl-key small muted" aria-hidden="true"><span><i class="dot great"></i>Go</span><span><i class="dot good"></i>Good</span><span><i class="dot marginal"></i>Iffy</span><span><i class="dot bad"></i>No</span><span><i class="uline"></i>Best window</span></div>
      </div>

      <div class="facts four">
        ${fact('wind', 'Wind', `${r0(s.winWind)} kn ${compass(s.winDir)}`, `gusts ${r0(s.winGust)} kn`)}
        ${fact('waves', 'Waves', `${r1(s.winWave)} m`, chopLabel(s.winChop ?? 0).toLowerCase())}
        ${fact('temp', 'Water', `${r1(s.sst)} °C`, `air ${r0(s.tempMin)}–${r0(s.tempMax)} °C`)}
        ${fact('moon', 'Tide', tide ? `${tide.type} ${fmtHM(tide.hour)}` : '–', d.moon.name.toLowerCase())}
      </div>

      <div class="fishline">
        <h3>Likely fish</h3>
        <div class="fchips">${chips}</div>
      </div>

      <details class="more" id="more"${state.moreOpen ? ' open' : ''}>
        <summary><span>Hour by hour, tides and local tips</span>${icon('chev', 'chev')}</summary>
        <div class="more-body">
          <section>
            <h3>Why this score</h3>
            <div class="subscores"><div>Kayak conditions <b class="tnum">${d.kayak}</b></div><div>Fishing <b class="tnum">${d.fishing}</b></div></div>
            <ul class="reasons">${d.reasons.map((x) => `<li class="${x.type}">${x.text}</li>`).join('')}</ul>
          </section>
          <section>
            <h3>Hour by hour</h3>
            <p class="muted small">Bars show wind, the line shows gusts (kn, left axis). Waves and swell are in metres on the right axis. The shaded band is your best window.</p>
            <div class="chart-box"><canvas id="chart"></canvas></div>
            <div class="table-scroll" style="margin-top:14px">
              <table class="hourly"><thead><tr><th>Time</th><th>Wind</th><th>Gust</th><th>Waves</th><th>Chop</th><th>Rain</th><th>Air</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>
            </div>
          </section>
          <section>
            <h3>All conditions</h3>
            <div class="stats">${stats}</div>
          </section>
          <section>
            <h3>Fish at ${spot.name} in ${fmtDay(d.date, { month: 'long' })}</h3>
            <p class="muted small">Ranked by season, today's sea temperature (${r1(s.sst)} °C) and how common they are here. Bar = Jan→Dec, darker = peak.</p>
            <div class="fish-list">${onFish.map(fishCard).join('')}</div>
            ${offFish.length ? `<details><summary>Out of season or unlikely right now (${offFish.length})</summary><div class="fish-list" style="margin-top:10px">${offFish.map(fishCard).join('')}</div></details>` : ''}
          </section>
          <section>
            <h3>Local knowledge</h3>
            <ul class="notes">${spot.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
          </section>
        </div>
      </details>
    </div>`;

  $('#spotPick').addEventListener('change', (e) => { if (e.target.value) select(e.target.value); });
  $('#favBtn').addEventListener('click', () => toggleFav(spot.id));
  $('#detail').querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const next = days[idx + Number(b.dataset.step)];
    if (next) select(state.spotId, next.date);
  }));
  if (chart) { chart.destroy(); chart = null; }
  const more = $('#more');
  if (state.moreOpen) renderChart(d);
  more.addEventListener('toggle', () => { state.moreOpen = more.open; if (more.open && !chart) renderChart(d); });
}

// ---------- chart ----------
const windowBand = {
  id: 'windowBand',
  beforeDatasetsDraw(c, _a, opts) {
    if (opts.start == null) return;
    const { ctx, chartArea: a, scales: { x } } = c;
    const x0 = x.getPixelForValue(opts.start) - x.width / x.ticks.length / 2;
    const x1 = x.getPixelForValue(opts.end - 1) + x.width / x.ticks.length / 2;
    ctx.save();
    ctx.fillStyle = opts.color;
    ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
    ctx.restore();
  },
};

function renderChart(d) {
  const hrs = d.hours.filter((h) => h.hour >= 4 && h.hour <= 21);
  const labels = hrs.map((h) => String(h.hour).padStart(2, '0'));
  const startIdx = hrs.findIndex((h) => h.hour === d.best.start);
  const text = cssVar('--muted'), grid = cssVar('--border');
  if (chart) chart.destroy();
  chart = new Chart($('#chart'), {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Wind (kn)', data: hrs.map((h) => h.wind), backgroundColor: cssVar('--wind'), borderRadius: 3, yAxisID: 'y', order: 3 },
        { type: 'line', label: 'Gusts (kn)', data: hrs.map((h) => h.gust), borderColor: cssVar('--gust'), backgroundColor: cssVar('--gust'), borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Waves (m)', data: hrs.map((h) => h.waveH), borderColor: cssVar('--wave'), backgroundColor: cssVar('--wave'), borderWidth: 2.5, pointRadius: 0, tension: 0.3, yAxisID: 'y2', order: 1 },
        { type: 'line', label: 'Swell (m)', data: hrs.map((h) => h.swellH), borderColor: cssVar('--swell'), backgroundColor: cssVar('--swell'), borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y2', order: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: text, boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { title: (it) => `${it[0].label}:00` } },
        windowBand: { start: startIdx >= 0 ? startIdx : null, end: startIdx + (d.best.end - d.best.start), color: 'color-mix(in srgb, ' + cssVar('--accent') + ' 12%, transparent)' },
      },
      scales: {
        x: { ticks: { color: text }, grid: { display: false } },
        y: { position: 'left', beginAtZero: true, suggestedMax: 25, title: { display: true, text: 'knots', color: text }, ticks: { color: text }, grid: { color: grid } },
        y2: { position: 'right', beginAtZero: true, suggestedMax: 2.5, title: { display: true, text: 'metres', color: text }, ticks: { color: text }, grid: { display: false } },
      },
    },
    plugins: [windowBand],
  });
}

// ---------- map ----------
function renderMap() {
  if (typeof L === 'undefined') return;
  if (!map) {
    map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap' }).addTo(map);
    map.fitBounds(SPOTS.map((s) => [s.lat, s.lon]), { padding: [30, 30] });
    map._kfMarkers = {};
    (window.NO_GO || []).forEach((z) => {
      L.marker([z.lat, z.lon], {
        icon: L.divIcon({ className: 'nogo', html: '⛔', iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).addTo(map).bindTooltip(`<b>${z.name}</b><br>${z.note}<br><span style="color:#666">Approximate position</span>`, { direction: 'top' });
    });
  }
  SPOTS.forEach((s) => {
    const r = state.results[s.id];
    const d = r && (visibleDays(r).find((x) => x.date === state.date) || visibleDays(r)[0]);
    const color = d ? cssVar(`--${d.verdict.key}`) : '#888';
    const html = `<b>${s.name}</b><br>${d ? `${fmtDay(d.date)}: ${d.verdict.label} (${d.overall})<br>Best ${fmtHM(d.best.start)}–${fmtHM(d.best.end)}` : ''}<br><span style="color:#666">Launch: ${s.launch}</span>`;
    let mk = map._kfMarkers[s.id];
    if (!mk) {
      mk = L.circleMarker([s.lat, s.lon], { radius: 11, weight: 3, color: '#fff', fillOpacity: 1 }).addTo(map);
      mk.on('click', () => select(s.id, null, true));
      mk.bindTooltip('', { direction: 'top' });
      map._kfMarkers[s.id] = mk;
    }
    mk.setStyle({ fillColor: color, color: s.id === state.spotId ? '#111' : '#fff' });
    mk.setTooltipContent(html);
  });
}

$('#refresh').addEventListener('click', () => load(true));

// ---------- light / dark toggle ----------
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');
function syncThemeButton() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const b = $('#theme');
  b.textContent = next === 'light' ? '☀️' : '🌙';
  b.title = `Switch to ${next} mode`;
  b.setAttribute("aria-label", b.title);
}
$('#theme').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('kf:theme', next); } catch (_) { /* ignore */ }
  syncThemeButton();
  if (Object.keys(state.results).length) render(); // chart + map colours come from CSS variables
});
// Follow the device if it changes and the user hasn't picked one.
systemDark.addEventListener?.('change', () => { if (!document.documentElement.dataset.theme) { syncThemeButton(); if (Object.keys(state.results).length) render(); } });
syncThemeButton();
readURL();
state.favs = loadFavs();
try { const a = localStorage.getItem('kf:area'); if (a === 'fav' || AREAS.includes(a)) state.area = a; } catch (_) { /* ignore */ }
if (state.area === 'fav' && !state.favs.size) state.area = 'all';
wireFilter();
wirePlan();
load();

// ---------- branding ----------
$('#spotCount').textContent = SPOTS.length;

// Animated tab title: a kayak paddling along through the waves, e.g. "🌊🌊🛶🌊 Kayak Fishing Planner".
(function animateTitle() {
  const NAME = 'Kayak Fishing Planner';
  const TRACK = 4; // number of wave slots the kayak travels through
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { document.title = `🛶 ${NAME}`; return; }
  let step = 0;
  const frame = () => {
    const pos = step % TRACK;
    document.title = `${Array.from({ length: TRACK }, (_, i) => (i === pos ? '🛶' : '🌊')).join('')} ${NAME}`;
    step++;
  };
  frame();
  setInterval(frame, 600);
})();
