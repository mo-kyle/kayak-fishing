// UI layer: renders the overview grid, best-day banner, day detail, chart, fish list and map.
// fmtHM, compass, windName, chopLabel come from engine.js (shared global scope).
const $ = (s) => document.querySelector(s);

const state = { results: {}, spotId: SPOTS[0].id, date: null };
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
  const settled = await Promise.allSettled(SPOTS.map((s) => Engine.loadSpot(s, force)));
  const errors = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') state.results[SPOTS[i].id] = r.value;
    else errors.push(`${SPOTS[i].name}: ${r.reason.message}`);
  });
  btn.disabled = false;
  if (!Object.keys(state.results).length) {
    showStatus(`Couldn't load the forecast. Check your connection and try again. (${errors.join('; ')})`, true);
    return;
  }
  errors.length ? showStatus(`Some spots failed to load: ${errors.join('; ')}`, true) : hideStatus();
  if (!state.results[state.spotId]) state.spotId = Object.keys(state.results)[0];
  const days = state.results[state.spotId].days;
  if (!state.date || !days.find((d) => d.date === state.date)) state.date = days[0]?.date;
  $('#updated').textContent = `Updated ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
  render();
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
  renderBest();
  renderOverview();
  renderDetail();
  renderMap();
}

// ---------- best-day banner ----------
function renderBest() {
  const el = $('#best');
  const all = [];
  Object.values(state.results).forEach((r) => r.days.forEach((d) => { if (!d.dayOver) all.push({ spot: r.spot, day: d }); }));
  all.sort((a, b) => b.day.overall - a.day.overall);
  const top = all[0];
  el.hidden = false;
  if (!top || top.day.overall < 60) {
    el.className = 'best none';
    el.onclick = null;
    el.innerHTML = `<div class="big">🌊</div><div><b>No standout days this week</b><p class="muted small">Nothing scores "Good" or better yet. Forecasts change, so check back in a day or two.</p></div>`;
    return;
  }
  const d = top.day;
  const others = all.slice(1, 3).filter((x) => x.day.overall >= 60);
  el.className = 'best';
  el.onclick = () => select(top.spot.id, d.date, true);
  el.innerHTML = `<div class="big">🎣</div><div>
    <b>Best this week: ${top.spot.name}, ${d.isToday ? 'today' : fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}, ${fmtHM(d.best.start)}–${fmtHM(d.best.end)}</b>
    <p class="small">Score ${d.overall}. Wind ${r0(d.stats.winWind)} kn, seas ${r1(d.stats.winWave)} m, water ${r1(d.stats.sst)} °C. ${d.species.filter((s) => s.likelihood >= 0.45).slice(0, 2).map((s) => s.name).join(' & ') || ''}</p>
    ${others.length ? `<p class="small muted">Also good: ${others.map((o) => `${o.spot.name} ${dayLabel(o.day)} (${o.day.overall})`).join(' · ')}</p>` : ''}
  </div>`;
}

// ---------- overview grid ----------
function renderOverview() {
  const results = SPOTS.map((s) => state.results[s.id]).filter(Boolean);
  const dates = results[0].days.map((d) => d.date);
  const head = `<tr><th></th>${dates.map((dt, i) => `<th>${i === 0 && results[0].days[0].isToday ? 'Today' : fmtDay(dt, { weekday: 'short' })}<br><span class="muted">${fmtDay(dt, { day: 'numeric', month: 'short' })}</span></th>`).join('')}</tr>`;
  const rows = results.map((r) => `<tr><th class="spot">${r.spot.name}<span>${r.spot.side}</span></th>${dates.map((dt) => {
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

// ---------- detail ----------
function ring(score, key) {
  const c = 2 * Math.PI * 52;
  return `<div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--${key})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(score / 100) * c} ${c}"/></svg>
    <div class="val"><div><b class="tnum">${score}</b><span>/ 100</span></div></div></div>`;
}

function renderDetail() {
  const r = state.results[state.spotId];
  const spot = r.spot;
  const d = r.days.find((x) => x.date === state.date) || r.days[0];
  const s = d.stats;

  const spotTabs = SPOTS.filter((x) => state.results[x.id]).map((x) => `<button class="tab${x.id === spot.id ? ' on' : ''}" data-spot="${x.id}">${x.name}</button>`).join('');
  const dayTabs = r.days.map((x) => `<button class="tab${x.date === d.date ? ' on' : ''}" data-date="${x.date}">${dayLabel(x)} <span class="pill ${x.verdict.key}">${x.overall}</span></button>`).join('');

  const tideTxt = d.tides.length ? d.tides.map((t) => `${t.type} ${fmtHM(t.hour)}`).join(' · ') : 'n/a';
  const moonTxt = d.moon.nearest <= 0.75 ? 'Today' : d.moon.toFull < d.moon.toNew ? `Full in ${Math.round(d.moon.toFull)} d` : `New in ${Math.round(d.moon.toNew)} d`;

  const stats = [
    ['Wind (daylight)', `${arrow(s.windDir)} ${r0(s.windAvg)} kn`, `${compass(s.windDir)} · max ${r0(s.windMax)} kn`],
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

  const nowH = Engine.nowHour();
  const rows = d.hours.filter((h) => h.hour >= 4 && h.hour <= 21).map((h) => {
    const night = h.hour < Math.floor(s.sunrise) || h.hour >= Math.ceil(s.sunset);
    const inWin = h.hour >= d.best.start && h.hour < d.best.end;
    const past = d.isToday && h.hour < nowH;
    return `<tr class="${night || past ? 'night' : ''}${inWin ? ' inwin' : ''}">
      <td class="tnum">${String(h.hour).padStart(2, '0')}:00${inWin ? ' ⭐' : ''}</td>
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
  const fishCard = (f) => `<div class="fish${f.likelihood < 0.2 ? ' dim' : ''}">
    <div class="fish-top"><h3>${f.name}</h3><span class="badge ${f.label.split(' ')[0]}">${f.label}</span></div>
    <div class="latin">${f.latin} · likes ${f.temp[0]}–${f.temp[1]} °C</div>
    <div class="months" title="Season: light = present, dark = peak">${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<i class="${f.peak.includes(m) ? 'pk' : f.present.includes(m) ? 'p' : ''}${m === month ? ' now' : ''}"></i>`).join('')}</div>
    <div class="meth">${f.method}</div>
    ${f.note ? `<div class="small muted">${f.note}</div>` : ''}
    ${f.closed ? `<div class="small warn">${FISH[f.id].closed.label}</div>` : ''}
  </div>`;
  const onFish = d.species.filter((f) => f.likelihood >= 0.2 || f.closed);
  const offFish = d.species.filter((f) => !(f.likelihood >= 0.2 || f.closed));

  $('#detail').innerHTML = `
    <div class="card">
      <div class="tabs">${spotTabs}</div>
      <div class="tabs daytabs">${dayTabs}</div>
    </div>

    <div class="card">
      <div class="verdict">
        ${ring(d.overall, d.verdict.key)}
        <div>
          <div class="muted small">${spot.name} · ${spot.side} · ${fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div class="vtitle">${d.verdict.label}</div>
          <div class="window">${d.dayOver ? 'Today\'s daylight is mostly gone. Best window earlier was ' : 'Best time on the water: '}<b>${fmtHM(d.best.start)}–${fmtHM(d.best.end)}</b>
            <span class="muted">· ${r0(s.winWind)} kn ${compass(s.winDir)}, gusts ${r0(s.winGust)} kn</span></div>
          <div class="subscores">
            <div>Kayak conditions <b class="tnum">${d.kayak}</b></div>
            <div>Fishing <b class="tnum">${d.fishing}</b></div>
            <div>Launch <b>${spot.launch}</b></div>
          </div>
          <ul class="reasons">${d.reasons.map((x) => `<li class="${x.type}">${x.text}</li>`).join('')}</ul>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Conditions</h2></div>
      <div class="stats">${stats}</div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Hour by hour</h2><p class="muted small">Bars show wind, the line shows gusts (kn, left axis). Waves and swell are in metres on the right axis. The shaded band is your best window.</p></div>
      <div class="chart-box"><canvas id="chart"></canvas></div>
      <div class="table-scroll" style="margin-top:14px">
        <table class="hourly"><thead><tr><th>Time</th><th>Wind</th><th>Gust</th><th>Waves</th><th>Chop</th><th>Rain</th><th>Air</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Fish at ${spot.name} in ${fmtDay(d.date, { month: 'long' })}</h2>
        <p class="muted small">Ranked by season, today's sea temperature (${r1(s.sst)} °C) and how common they are here. Bar = Jan→Dec, darker = peak.</p></div>
      <div class="fish-list">${onFish.map(fishCard).join('')}</div>
      ${offFish.length ? `<details><summary>Out of season or unlikely right now (${offFish.length})</summary><div class="fish-list" style="margin-top:10px">${offFish.map(fishCard).join('')}</div></details>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><h2>Local knowledge: ${spot.name}</h2></div>
      <ul class="notes">${spot.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
    </div>`;

  $('#detail').querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => select(b.dataset.spot)));
  $('#detail').querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => select(state.spotId, b.dataset.date)));
  renderChart(d);
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
    const d = r?.days.find((x) => x.date === state.date) || r?.days[0];
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

// ---------- Frutiger Aero toggle ----------
function syncSkinButton() {
  const on = document.documentElement.dataset.skin === 'aero';
  const b = $('#skin');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? '🌙 Classic' : '✨ Aero';
}
$('#skin').addEventListener('click', () => {
  const root = document.documentElement;
  const on = root.dataset.skin !== 'aero';
  if (on) root.dataset.skin = 'aero'; else delete root.dataset.skin;
  try { localStorage.setItem('kf:skin', on ? 'aero' : 'classic'); } catch (_) { /* ignore */ }
  syncSkinButton();
  if (Object.keys(state.results).length) render(); // chart + map colours come from CSS variables
});
syncSkinButton();
load();
