// Forecast fetching + scoring. Data: Open-Meteo (free, open, no API key).
// Moon phase: SunCalc (open source).

const TZ = 'Africa/Johannesburg';
const CACHE_MINUTES = 30;
const FORECAST_DAYS = 7;

// ---------- small helpers ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (a) => { const v = a.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const max = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.max(...v) : null; };
const min = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.min(...v) : null; };
const angleDiff = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };

/** Piecewise-linear lookup: pts = [[x, y], ...] ascending by x. */
function curve(x, pts) {
  if (x == null) return null;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (deg) => (deg == null ? '–' : COMPASS[Math.round(deg / 22.5) % 16]);

function windName(deg) {
  const c = compass(deg);
  if (['SE', 'SSE', 'ESE'].includes(c)) return 'south-easter';
  if (['NW', 'NNW', 'WNW'].includes(c)) return 'north-wester';
  if (['SW', 'SSW', 'WSW'].includes(c)) return 'south-wester';
  return `${c} wind`;
}

/** Vector-average wind direction (degrees FROM). */
function meanDir(dirs, weights) {
  let x = 0, y = 0;
  dirs.forEach((d, i) => {
    if (d == null) return;
    const w = weights ? weights[i] || 0 : 1;
    x += Math.sin((d * Math.PI) / 180) * w;
    y += Math.cos((d * Math.PI) / 180) * w;
  });
  if (x === 0 && y === 0) return null;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function nowHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);
}
const decHour = (iso) => (iso ? parseInt(iso.slice(11, 13), 10) + parseInt(iso.slice(14, 16), 10) / 60 : null);
const fmtHM = (h) => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(mm === 60 ? hh + 1 : hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
};
const noonDate = (date) => new Date(`${date}T12:00:00+02:00`);

// ---------- fetching ----------
async function getJSON(url, force) {
  const key = `kf:${url}`;
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(key));
      if (c && Date.now() - c.t < CACHE_MINUTES * 60e3) return c.d;
    } catch (_) { /* storage unavailable */ }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  const d = await r.json();
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (_) { /* ignore */ }
  return d;
}

function weatherUrl(s) {
  const p = new URLSearchParams({
    latitude: s.lat, longitude: s.lon, timezone: TZ, forecast_days: FORECAST_DAYS, past_days: 1,
    wind_speed_unit: 'kn',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl',
    daily: 'sunrise,sunset,uv_index_max',
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}
function marineUrl(s) {
  const p = new URLSearchParams({
    latitude: s.marineLat, longitude: s.marineLon, timezone: TZ, forecast_days: FORECAST_DAYS, past_days: 1,
    cell_selection: 'sea',
    hourly: 'wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity',
  });
  return `https://marine-api.open-meteo.com/v1/marine?${p}`;
}

async function loadSpot(spot, force) {
  const [w, m] = await Promise.all([getJSON(weatherUrl(spot), force), getJSON(marineUrl(spot), force)]);
  const res = analyseSpot(spot, w, m);
  res.raw = { w, m }; // kept so the UI can re-score for a different time range without refetching
  return res;
}

// ---------- per-hour conditions ----------
function buildHours(w, m) {
  const idx = new Map(m.hourly.time.map((t, i) => [t, i]));
  const W = w.hourly, M = m.hourly;
  return W.time.map((t, i) => {
    const j = idx.get(t);
    const mv = (k) => (j == null || !M[k] ? null : M[k][j]);
    return {
      time: t, date: t.slice(0, 10), hour: parseInt(t.slice(11, 13), 10),
      temp: W.temperature_2m[i], feels: W.apparent_temperature[i],
      rainProb: W.precipitation_probability[i], rain: W.precipitation[i],
      code: W.weather_code[i], cloud: W.cloud_cover[i], vis: W.visibility[i],
      wind: W.wind_speed_10m[i], windDir: W.wind_direction_10m[i], gust: W.wind_gusts_10m[i],
      pressure: W.pressure_msl[i],
      waveH: mv('wave_height'), waveDir: mv('wave_direction'), waveT: mv('wave_period'),
      windWaveH: mv('wind_wave_height'), windWaveT: mv('wind_wave_period'),
      swellH: mv('swell_wave_height'), swellT: mv('swell_wave_period'), swellDir: mv('swell_wave_direction'),
      sst: mv('sea_surface_temperature'), seaLevel: mv('sea_level_height_msl'), current: mv('ocean_current_velocity'),
    };
  });
}

/**
 * Choppiness 0–10. Steep, short-period wind waves are what make a kayak uncomfortable,
 * so we blend wave steepness (H / wavelength, deep-water L = 1.56·T²), wind-sea height and wind speed.
 */
function chopIndex(h) {
  const Hw = h.windWaveH ?? 0;
  const Tw = h.windWaveT ?? 0;
  const steep = Tw > 0 ? Hw / (1.56 * Tw * Tw) : 0;
  const c = (Math.min(steep, 0.06) / 0.06) * 4 + Math.min(Hw / 1.2, 1) * 3 + Math.min((h.wind ?? 0) / 25, 1) * 3;
  return clamp(c, 0, 10);
}
function chopLabel(c) {
  if (c < 2) return 'Glassy';
  if (c < 4) return 'Light chop';
  if (c < 6) return 'Moderate chop';
  if (c < 8) return 'Choppy';
  return 'Rough';
}

function isOffshore(spot, dir) {
  return dir != null && angleDiff(dir, (spot.facing + 180) % 360) <= 67.5;
}

/** Kayak safety/comfort score 0–100 for one hour. */
function kayakScore(spot, h) {
  const windS = curve(h.wind, [[0, 100], [8, 100], [12, 85], [15, 65], [18, 40], [22, 15], [26, 0]]);
  const waveS = h.waveH == null ? 70 : curve(h.waveH, [[0, 100], [0.8, 100], [1.2, 85], [1.8, 65], [2.5, 40], [3.5, 10], [4.5, 0]]);
  const chopS = 100 - h.chop * 10;
  let s = 0.4 * windS + 0.35 * waveS + 0.25 * chopS;
  if (h.gust > 18) s -= (h.gust - 18) * 3;
  if (isOffshore(spot, h.windDir) && h.wind > 8) s -= (h.wind - 8) * 5;
  if (h.rainProb >= 70) s -= 15; else if (h.rainProb >= 40) s -= 7;
  if (h.vis != null && h.vis < 2000) s -= 15;
  s = Math.min(s, Math.min(windS, waveS) + 25);
  if (h.code >= 95) s = 0; // thunderstorm
  return clamp(Math.round(s), 0, 100);
}

// ---------- tides (from modelled sea-level height) ----------
function findTides(hours) {
  const out = [];
  for (let i = 1; i < hours.length - 1; i++) {
    const a = hours[i - 1].seaLevel, b = hours[i].seaLevel, c = hours[i + 1].seaLevel;
    if (a == null || b == null || c == null) continue;
    const isHigh = b > a && b >= c, isLow = b < a && b <= c;
    if (!isHigh && !isLow) continue;
    const denom = a - 2 * b + c;
    const off = denom !== 0 ? clamp((0.5 * (a - c)) / denom, -0.5, 0.5) : 0;
    let hour = hours[i].hour + off;
    let date = hours[i].date;
    if (hour < 0) { hour += 24; date = hours[i - 1].date; }
    if (hour >= 24) { hour -= 24; date = hours[i + 1].date; }
    out.push({ type: isHigh ? 'High' : 'Low', date, hour, level: b });
  }
  return out;
}

// ---------- fish ----------
function inClosedSeason(fish, date) {
  if (!fish.closed) return false;
  const md = parseInt(date.slice(5, 7), 10) * 100 + parseInt(date.slice(8, 10), 10);
  const from = fish.closed.from[0] * 100 + fish.closed.from[1];
  const to = fish.closed.to[0] * 100 + fish.closed.to[1];
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

function speciesFor(spot, date, sst) {
  const month = parseInt(date.slice(5, 7), 10);
  return spot.fish.map((f) => {
    const info = FISH[f.id];
    const season = f.peak.includes(month) ? 1 : f.present.includes(month) ? 0.5 : 0;
    let tempFit = 0.7;
    if (sst != null) {
      const [lo, hi] = info.temp;
      const off = sst < lo ? lo - sst : sst > hi ? sst - hi : 0;
      tempFit = off === 0 ? 1 : off <= 2 ? 0.6 : 0.25;
    }
    const closed = inClosedSeason(info, date);
    const likelihood = closed ? 0 : season * tempFit * f.abundance;
    let label;
    if (closed) label = 'Closed season';
    else if (season === 0) label = 'Out of season';
    else if (likelihood >= 0.7) label = 'Prime';
    else if (likelihood >= 0.45) label = 'Good chance';
    else if (likelihood >= 0.2) label = 'Possible';
    else label = 'Unlikely';
    return { id: f.id, ...info, season, tempFit, closed, likelihood, label, peak: f.peak, present: f.present };
  }).sort((a, b) => b.likelihood - a.likelihood);
}

// ---------- moon ----------
const LUNAR = 29.530588;
function moonInfo(date) {
  const { phase, fraction } = SunCalc.getMoonIllumination(noonDate(date));
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const name = names[Math.round(phase * 8) % 8];
  const toFull = ((0.5 - phase + 1) % 1) * LUNAR;
  const toNew = ((1 - phase) % 1) * LUNAR;
  const sinceFull = ((phase - 0.5 + 1) % 1) * LUNAR;
  const sinceNew = phase * LUNAR;
  const nearest = Math.min(toFull, toNew, sinceFull, sinceNew);
  const emoji = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round(phase * 8) % 8];
  const nearNew = Math.min(toNew, sinceNew) < Math.min(toFull, sinceFull); // closest phase, looking both ways
  return { phase, fraction, name, emoji, toFull, toNew, nearest, nearNew, spring: nearest <= 2.5 };
}

// ---------- day analysis ----------
/** opts.start / opts.end = hours (0–24) you're available; the window must fit inside them. */
function analyseSpot(spot, w, m, opts = {}) {
  const hours = buildHours(w, m);
  hours.forEach((h) => { h.chop = chopIndex(h); h.offshore = isOffshore(spot, h.windDir); h.score = kayakScore(spot, h); });
  const tides = findTides(hours);
  const today = todayStr();
  const D = w.daily;
  const days = [];
  D.time.forEach((date, di) => {
    if (date < today) return;
    const dh = hours.filter((h) => h.date === date);
    if (dh.length < 20) return;
    const prev = di > 0 ? hours.filter((h) => h.date === D.time[di - 1]) : [];
    days.push(analyseDay(spot, date, dh, prev, D.sunrise[di], D.sunset[di], D.uv_index_max?.[di], tides.filter((t) => t.date === date), opts));
  });
  return { spot, hours, days, tides, fetchedAt: Date.now() };
}

function analyseDay(spot, date, dh, prev, sunrise, sunset, uv, tides, opts = {}) {
  const sr = decHour(sunrise), ss = decHour(sunset);
  const isToday = date === todayStr();
  const nh = nowHour();
  // The user's available hours (default: all day). Day figures and the best window only use these.
  const uStart = opts.start ?? 0, uEnd = opts.end ?? 24;
  const inUser = (h) => h.hour >= uStart && h.hour + 1 <= uEnd;
  const fullDaylight = dh.filter((h) => h.hour >= Math.floor(sr) && h.hour < Math.ceil(ss));
  let daylight = fullDaylight.filter(inUser);
  const outsideDaylight = daylight.length === 0;
  if (outsideDaylight) daylight = dh.filter(inUser);
  let cand = isToday ? daylight.filter((h) => h.hour >= nh) : daylight;
  // Spots with gate hours (e.g. Cape Point reserve): only suggest windows you can actually use.
  const access = spot.access ? spot.access(parseInt(date.slice(5, 7), 10)) : null;
  const inAccess = (h) => !access || (h.hour >= access.open && h.hour + 1 <= access.close);
  const accessible = daylight.filter(inAccess);
  const gatesClosed = !!access && accessible.length === 0;
  cand = cand.filter(inAccess);
  const dayOver = isToday && cand.length < 2;
  if (dayOver) cand = accessible.length ? accessible : daylight;
  if (!cand.length) cand = daylight;

  // Best 3-hour paddling window (rewards a good average AND no single bad hour).
  const W = 3;
  let best = null;
  for (let i = 0; i + W <= cand.length; i++) {
    const seg = cand.slice(i, i + W);
    if (seg[W - 1].hour - seg[0].hour !== W - 1) continue;
    const sc = mean(seg.map((h) => h.score)) * 0.7 + min(seg.map((h) => h.score)) * 0.3;
    if (!best || sc > best.score) best = { score: sc, start: seg[0].hour, end: seg[W - 1].hour + 1, hours: seg };
  }
  if (!best) best = { score: mean(cand.map((h) => h.score)), start: cand[0].hour, end: cand.at(-1).hour + 1, hours: cand };
  best.score = Math.round(best.score);

  const win = best.hours;
  const morning = daylight.filter((h) => h.hour < 11);
  const arvo = daylight.filter((h) => h.hour >= 13);
  const sst = mean(daylight.map((h) => h.sst));
  const prevSst = mean(prev.map((h) => h.sst));
  const pMean = mean(dh.map((h) => h.pressure));
  const prevP = mean(prev.map((h) => h.pressure));

  const stats = {
    sunrise: sr, sunset: ss, uv,
    windAvg: mean(daylight.map((h) => h.wind)), windMax: max(daylight.map((h) => h.wind)),
    gustMax: max(daylight.map((h) => h.gust)),
    windDir: meanDir(daylight.map((h) => h.windDir), daylight.map((h) => h.wind)),
    winWind: mean(win.map((h) => h.wind)), winGust: max(win.map((h) => h.gust)),
    winDir: meanDir(win.map((h) => h.windDir), win.map((h) => h.wind)),
    morningWind: mean(morning.map((h) => h.wind)), arvoWind: mean(arvo.map((h) => h.wind)),
    waveAvg: mean(daylight.map((h) => h.waveH)), waveMax: max(daylight.map((h) => h.waveH)),
    winWave: mean(win.map((h) => h.waveH)),
    swellH: mean(daylight.map((h) => h.swellH)), swellT: mean(daylight.map((h) => h.swellT)),
    swellDir: meanDir(daylight.map((h) => h.swellDir)),
    waveT: mean(daylight.map((h) => h.waveT)),
    chopAvg: mean(daylight.map((h) => h.chop)), winChop: mean(win.map((h) => h.chop)),
    sst, sstChange: sst != null && prevSst != null ? sst - prevSst : null,
    tempMin: min(daylight.map((h) => h.temp)), tempMax: max(daylight.map((h) => h.temp)),
    rainProbMax: max(daylight.map((h) => h.rainProb)), rainSum: dh.reduce((s, h) => s + (h.rain || 0), 0),
    thunder: daylight.some((h) => h.code >= 95),
    fog: win.some((h) => h.vis != null && h.vis < 2000),
    currentMax: max(win.map((h) => h.current)),
    pressure: pMean, pressureChange: pMean != null && prevP != null ? pMean - prevP : null,
    offshoreHours: daylight.filter((h) => h.offshore && h.wind > 12).length,
    offshoreDir: meanDir(daylight.filter((h) => h.offshore && h.wind > 12).map((h) => h.windDir)),
  };

  const moon = moonInfo(date);
  const species = speciesFor(spot, date, sst);
  const dayTides = tides.filter((t) => t.hour >= sr - 0.5 && t.hour <= ss + 0.5);
  const tideInWindow = tides.find((t) => t.hour >= best.start - 1.5 && t.hour <= best.end + 1.5);

  // ---- fishing score ----
  const top = species.filter((s) => s.likelihood > 0).slice(0, 3);
  const speciesScore = top.length ? clamp((mean(top.map((s) => s.likelihood)) / 0.85) * 100, 0, 100) : 10;
  const moonScore = 100 - (Math.min(moon.nearest, 7.4) / 7.4) * 50;
  const tideScore = tideInWindow ? 100 : dayTides.length ? 70 : 50;
  const dp = stats.pressureChange;
  const pressureScore = dp == null ? 75 : dp < -5 ? 55 : dp < -1.5 ? 100 : dp <= 1.5 ? 85 : dp <= 5 ? 70 : 50;
  const dT = stats.sstChange;
  const waterScore = dT == null ? 75 : dT < -1.5 ? 40 : dT < -0.7 ? 65 : 85;
  const fishing = Math.round(0.35 * speciesScore + 0.15 * moonScore + 0.2 * tideScore + 0.15 * pressureScore + 0.15 * waterScore);

  // ---- overall ----
  // Conditions in the 2 hours after the window matter too: you have to paddle back in them.
  const after = dh.filter((h) => h.hour >= best.end && h.hour < best.end + 2);
  best.returnScore = after.length ? min(after.map((h) => h.score)) : null;
  best.returnGust = after.length ? max(after.map((h) => h.gust)) : null;
  const kayak = Math.round(best.returnScore == null ? best.score : 0.75 * best.score + 0.25 * Math.min(best.score, best.returnScore));
  let overall = Math.round(0.6 * kayak + 0.4 * fishing);
  if (kayak < 45) overall = Math.min(overall, kayak + 5);
  if (stats.thunder) overall = Math.min(overall, 20);
  if (outsideDaylight || gatesClosed) overall = Math.min(overall, 20);

  const reasons = buildReasons(spot, stats, best, moon, species, tideInWindow, dayTides);
  if (gatesClosed) reasons.unshift({ type: 'bad', text: `The park gates are closed during your hours (${fmtHM(uStart)}–${fmtHM(uEnd)}), so you can't launch here then` });
  if (outsideDaylight) reasons.unshift({ type: 'bad', text: `Your hours (${fmtHM(uStart)}–${fmtHM(uEnd)}) are in the dark. Paddling at night isn't recommended.` });
  if (access && !gatesClosed) reasons.unshift({ type: 'ok', text: `Park gates: you're on the water about ${fmtHM(access.open)} at the earliest and must be off by ${fmtHM(access.close)} (approximate times, check SANParks)` });

  return { date, isToday, dayOver, hours: dh, daylight, best, stats, moon, species, tides: dayTides, tideInWindow, kayak, fishing, overall, reasons, verdict: verdictFor(overall) };
}

function verdictFor(score) {
  if (score >= 75) return { key: 'great', label: 'Great day, go fishing', short: 'Go' };
  if (score >= 60) return { key: 'good', label: 'Good day', short: 'Good' };
  if (score >= 45) return { key: 'marginal', label: 'Marginal: stay close to shore', short: 'Iffy' };
  return { key: 'bad', label: 'Stay on land', short: 'No' };
}

function buildReasons(spot, s, best, moon, species, tideInWindow, dayTides) {
  const R = [];
  const add = (type, text) => R.push({ type, text });
  const win = `${fmtHM(best.start)}–${fmtHM(best.end)}`;

  // Safety / comfort
  if (s.thunder) add('bad', 'Thunderstorms forecast. Don\'t go out on the water.');
  if (s.winWind <= 8) add('good', `Light wind (${Math.round(s.winWind)} kn) during your best window, ${win}`);
  else if (s.winWind <= 13) add('ok', `Moderate wind (${Math.round(s.winWind)} kn ${compass(s.winDir)}) during ${win}`);
  else add('bad', `Even the best window has ${Math.round(s.winWind)} kn of ${windName(s.winDir)}`);
  if (best.returnScore != null && best.returnScore < 45) add('bad', `Conditions turn quickly after ${fmtHM(best.end)} (gusts ${Math.round(best.returnGust)} kn). Don't overstay.`);
  if (s.gustMax >= 25) add('bad', `Gusts up to ${Math.round(s.gustMax)} kn during the day`);
  else if (s.gustMax >= 18) add('ok', `Gusts up to ${Math.round(s.gustMax)} kn later in the day`);
  if (s.offshoreHours >= 2) add('bad', `${Math.round(s.offshoreHours)}h of offshore ${windName(s.offshoreDir)} over 12 kn. It can blow you out to sea at ${spot.name}.`);
  if (s.arvoWind != null && s.morningWind != null && s.arvoWind - s.morningWind >= 6 && s.arvoWind >= 12) add('ok', `Wind builds from ${Math.round(s.morningWind)} to ${Math.round(s.arvoWind)} kn by the afternoon. Be back early.`);
  if (s.waveMax != null) {
    if (s.waveMax >= 2.5) add('bad', `Seas up to ${s.waveMax.toFixed(1)} m. Launching and landing will be hard.`);
    else if (s.waveMax >= 1.5) add('ok', `Swell around ${s.waveAvg.toFixed(1)} m (max ${s.waveMax.toFixed(1)} m)`);
    else add('good', `Small seas, ${s.waveAvg.toFixed(1)} m`);
  }
  if (s.winChop != null) {
    if (s.winChop < 3) add('good', `${chopLabel(s.winChop)} water in the window`);
    else if (s.winChop >= 6) add('bad', `${chopLabel(s.winChop)} water. It will be wet and uncomfortable.`);
  }
  if (s.rainProbMax >= 60) add('ok', `Rain likely (${s.rainProbMax}%)`);
  if (s.fog) add('ok', 'Fog possible. Take a VHF radio or GPS and stay close.');
  if (s.currentMax >= 1.5) add('ok', `Current up to ${s.currentMax.toFixed(1)} km/h`);

  // Fishing
  const hot = species.filter((x) => x.likelihood >= 0.45).slice(0, 3);
  if (hot.length) add('fish', `${hot.map((x) => x.name).join(', ')} ${hot.length > 1 ? 'are' : 'is'} on the cards`);
  if (s.sst != null) {
    if (s.sstChange != null && s.sstChange < -1.5) add('ok', `Water dropped ${Math.abs(s.sstChange).toFixed(1)} °C to ${s.sst.toFixed(1)} °C (upwelling). The bite may be slow.`);
    else add('fish', `Sea temperature ${s.sst.toFixed(1)} °C`);
  }
  if (moon.nearest <= 2.5) add('fish', `${moon.nearNew ? 'New' : 'Full'} moon period. Strong tidal movement often turns fish on.`);
  if (tideInWindow) add('fish', `${tideInWindow.type} tide around ${fmtHM(tideInWindow.hour)}. Fish the change.`);
  const dp = s.pressureChange;
  if (dp != null) {
    if (dp < -5) add('ok', `Pressure falling fast (${dp.toFixed(1)} hPa). A front is likely on the way.`);
    else if (dp < -1.5) add('fish', 'Pressure easing slowly, which is classic feeding weather');
    else if (dp > 5) add('ok', 'Pressure rising sharply after a front. Fish are often slow.');
  }
  return R;
}

window.Engine = { loadSpot, analyseSpot, fmtHM, compass, windName, chopLabel, todayStr, nowHour, verdictFor };
