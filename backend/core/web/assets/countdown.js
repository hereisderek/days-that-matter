// Countdown engine and page behavior for the share page.
// ES module, no dependencies. The pure functions are also imported by the Worker
// (src/page/render.ts) and by the golden-vector tests, so keep the top level free of DOM access.
//
// Semantics (docs/features/events/SPEC.md section 2, docs/architecture/SHARE_SERVICE.md 7.3):
// - totals (totalDays/Hours/Minutes/Seconds) use real elapsed time between two instants.
// - the calendar breakdown (years..seconds) uses wall-clock fields in the event zone, with
//   end-of-month clamping (Jan 31 + 1 month = Feb 28/29).
// - local date + time to instant: a time in a DST gap moves forward by the gap length,
//   an ambiguous time (DST overlap) takes the earlier instant.
// - a date-only event counts to 00:00:00 in its zone. timeZone null means the viewer's zone.
// - "today" means the local date in the event zone equals the occurrence date.

const DAY_MS = 86400000;
const formatterCache = new Map();

function formatterFor(zone) {
  let f = formatterCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatterCache.set(zone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a zone, as {y, mo, d, h, mi, s}. */
export function localFields(ms, zone) {
  const out = {};
  for (const p of formatterFor(zone).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour % 24, mi: out.minute, s: out.second };
}

/** Wall-clock fields read as a UTC timestamp ("fake UTC"). */
function fake(f) {
  const t = Date.UTC(2000, f.mo - 1, f.d, f.h, f.mi, f.s);
  const d = new Date(t);
  d.setUTCFullYear(f.y); // Date.UTC maps years 0-99 to 1900+, setUTCFullYear does not
  return d.getTime();
}

function offsetAt(ms, zone) {
  return fake(localFields(ms, zone)) - Math.floor(ms / 1000) * 1000;
}

/** Converts wall-clock fields in a zone to an instant (ms). See the header for gap/overlap rules. */
export function zonedToInstant(f, zone) {
  const guess = fake(f);
  const o1 = offsetAt(guess - DAY_MS, zone);
  const o2 = offsetAt(guess + DAY_MS, zone);
  const valid = [];
  for (const o of new Set([o1, o2])) {
    const t = guess - o;
    if (offsetAt(t, zone) === o) valid.push(t);
  }
  if (valid.length > 0) return Math.min(...valid);
  return guess - o1; // gap: shift forward by the gap length
}

function pad(n, w) {
  return String(n).padStart(w, '0');
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return { y: +m[1], mo: +m[2], d: +m[3] };
}

function parseTime(s) {
  if (!s) return { h: 0, mi: 0, s: 0 };
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  return { h: +m[1], mi: +m[2], s: +m[3] };
}

function daysInMonth(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function dayNumber(dt) {
  return Math.floor(fake({ ...dt, h: 0, mi: 0, s: 0 }) / DAY_MS);
}

function fromDayNumber(n) {
  const d = new Date(n * DAY_MS);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function cmpDate(a, b) {
  return a.y - b.y || a.mo - b.mo || a.d - b.d;
}

/** Date of the first occurrence on or after `today` (a {y, mo, d} in the event zone). */
export function nextOccurrenceDate(payload, today) {
  const base = parseDate(payload.targetDate);
  const rec = payload.recurrence || { type: 'none' };
  switch (rec.type) {
    case 'yearly': {
      let y = Math.max(base.y, rec.originalYear == null ? base.y : rec.originalYear);
      if (y < today.y) y = today.y;
      for (; ; y++) {
        const occ = { y, mo: base.mo, d: Math.min(base.d, daysInMonth(y, base.mo)) };
        if (cmpDate(occ, today) >= 0) return occ;
      }
    }
    case 'monthly': {
      let idx = base.y * 12 + (base.mo - 1);
      const todayIdx = today.y * 12 + (today.mo - 1);
      if (idx < todayIdx) idx = todayIdx;
      for (; ; idx++) {
        const y = Math.floor(idx / 12);
        const mo = (idx % 12) + 1;
        const occ = { y, mo, d: Math.min(base.d, daysInMonth(y, mo)) };
        if (cmpDate(occ, today) >= 0) return occ;
      }
    }
    case 'weekly':
    case 'customDays': {
      const step = rec.type === 'weekly' ? 7 : rec.days;
      const b = dayNumber(base);
      const t = dayNumber(today);
      if (b >= t) return base;
      return fromDayNumber(b + Math.ceil((t - b) / step) * step);
    }
    default:
      return base;
  }
}

function addMonthsClamped(f, months) {
  const idx = f.y * 12 + (f.mo - 1) + months;
  const y = Math.floor(idx / 12);
  const mo = (idx % 12) + 1;
  return { ...f, y, mo, d: Math.min(f.d, daysInMonth(y, mo)) };
}

/** Calendar breakdown between two wall-clock values a <= b. */
export function breakdown(a, b) {
  const fa = fake(a);
  const fb = fake(b);
  let k = (b.y - a.y) * 12 + (b.mo - a.mo);
  if (k < 0) k = 0;
  while (k > 0 && fake(addMonthsClamped(a, k)) > fb) k--;
  const rem = Math.max(0, fb - fake(addMonthsClamped(a, k)));
  return {
    years: Math.floor(k / 12),
    months: k % 12,
    days: Math.floor(rem / DAY_MS),
    hours: Math.floor((rem % DAY_MS) / 3600000),
    minutes: Math.floor((rem % 3600000) / 60000),
    seconds: Math.floor((rem % 60000) / 1000),
  };
}

/**
 * Computes the countdown state for a share payload at `nowMs`.
 * `viewerZone` is used when payload.timeZone is null.
 */
export function compute(payload, nowMs, viewerZone) {
  const zone = payload.timeZone || viewerZone || 'UTC';
  const nowLocal = localFields(nowMs, zone);
  const today = { y: nowLocal.y, mo: nowLocal.mo, d: nowLocal.d };
  const occ = nextOccurrenceDate(payload, today);
  const time = parseTime(payload.targetTime);
  const targetLocal = { ...occ, ...time };
  const targetMs = zonedToInstant(targetLocal, zone);
  const isToday = cmpDate(occ, today) === 0;
  const isPast = !isToday && targetMs < nowMs;
  const diffMs = Math.abs(targetMs - nowMs);
  const range = targetMs >= nowMs ? [nowLocal, targetLocal] : [targetLocal, nowLocal];
  const rec = payload.recurrence || { type: 'none' };
  const anniversary =
    rec.type === 'yearly' && rec.originalYear != null ? occ.y - rec.originalYear : null;
  return {
    zone,
    occurrenceDate: `${pad(occ.y, 4)}-${pad(occ.mo, 2)}-${pad(occ.d, 2)}`,
    targetMs,
    direction: isToday ? 'today' : isPast ? 'since' : 'until',
    isToday,
    isPast,
    upcoming: targetMs >= nowMs,
    totalDays: Math.floor(diffMs / DAY_MS),
    totalHours: Math.floor(diffMs / 3600000),
    totalMinutes: Math.floor(diffMs / 60000),
    totalSeconds: Math.floor(diffMs / 1000),
    ...breakdown(range[0], range[1]),
    anniversary,
  };
}

function plural(n, one, many) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** Short text such as "124 days to go" or "3 years, 4 months, 12 days since". */
export function summaryText(state, unitMode) {
  const suffix = state.direction === 'since' ? 'ago' : 'to go';
  if (state.direction === 'today' && !state.upcoming) return 'Today';
  const mode = unitMode || 'auto';
  let body;
  if (mode === 'calendar') {
    const parts = [];
    if (state.years) parts.push(plural(state.years, 'year', 'years'));
    if (state.months) parts.push(plural(state.months, 'month', 'months'));
    parts.push(plural(state.days, 'day', 'days'));
    body = parts.join(', ');
  } else if (mode === 'auto' && state.totalHours < 48) {
    body = `${state.totalHours}h ${pad(state.minutes, 2)}m ${pad(state.seconds, 2)}s`;
  } else {
    body = plural(state.totalDays, 'day', 'days');
  }
  return `${body} ${suffix}`;
}

/** Ordinal such as 1st, 2nd, 3rd, 11th. */
export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

/** Ticker cells [{unit, value}] for the unit mode. Empty when nothing is left to count today. */
export function cells(state, unitMode) {
  const mode = unitMode || 'auto';
  if (state.direction === 'today') {
    return state.upcoming
      ? [
          { unit: 'hours', value: state.totalHours },
          { unit: 'minutes', value: state.totalMinutes % 60 },
          { unit: 'seconds', value: state.totalSeconds % 60 },
        ]
      : [];
  }
  if (mode === 'calendar') {
    const out = [];
    if (state.years > 0) out.push({ unit: 'years', value: state.years });
    if (state.years > 0 || state.months > 0) out.push({ unit: 'months', value: state.months });
    out.push(
      { unit: 'days', value: state.days },
      { unit: 'hours', value: state.hours },
      { unit: 'minutes', value: state.minutes },
      { unit: 'seconds', value: state.seconds },
    );
    return out;
  }
  if (mode === 'auto' && state.totalHours < 48) {
    return [
      { unit: 'hours', value: state.totalHours },
      { unit: 'minutes', value: state.totalMinutes % 60 },
      { unit: 'seconds', value: state.totalSeconds % 60 },
    ];
  }
  return [
    { unit: 'days', value: state.totalDays },
    { unit: 'hours', value: state.totalHours % 24 },
    { unit: 'minutes', value: state.totalMinutes % 60 },
    { unit: 'seconds', value: state.totalSeconds % 60 },
  ];
}

// ---------------------------------------------------------------------------
// Browser behavior. Runs only on the share page (element #share-data present).
// All user data reaches the DOM through textContent or CSSOM only.
// ---------------------------------------------------------------------------

const HEX = /^#[0-9A-Fa-f]{6}$/;

function initPage() {
  const blob = document.getElementById('share-data');
  if (!blob) return;
  let data;
  try {
    data = JSON.parse(blob.textContent);
  } catch {
    return;
  }
  const payload = data.payload;
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Skew correction: offset between the server clock and this device's clock.
  const serverMs = Date.parse(data.serverTime);
  const skew = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  const now = () => Date.now() + skew;

  const card = document.getElementById('share-card');
  const ticker = document.getElementById('share-ticker');
  const kicker = document.getElementById('share-kicker');
  const live = document.getElementById('share-live');
  const when = document.getElementById('share-when');
  const anniv = document.getElementById('share-anniversary');

  const grad = payload.theme && payload.theme.gradient;
  if (card && Array.isArray(grad) && grad.length === 2 && grad.every((g) => HEX.test(g))) {
    card.style.setProperty('--card-from', grad[0]);
    card.style.setProperty('--card-to', grad[1]);
  }

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion && card) card.dataset.motion = 'reduced';

  // Banner: show the Android one on Android only.
  if (/Android/i.test(navigator.userAgent)) {
    const b = document.getElementById('banner-android');
    if (b) b.hidden = false;
  }

  let cellEls = [];
  let cellKey = '';
  let lastSummaryMinute = -1;

  function render() {
    const state = compute(payload, now(), viewerZone);
    if (kicker) {
      kicker.textContent =
        state.direction === 'today' ? 'Today is the day' : state.direction === 'since' ? 'Since' : 'Until';
    }
    if (anniv) {
      anniv.textContent = state.anniversary && state.anniversary > 0 ? `${ordinal(state.anniversary)} anniversary` : '';
      anniv.hidden = !anniv.textContent;
    }
    if (when) {
      when.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: payload.targetTime ? 'short' : undefined,
        timeZone: state.zone,
      }).format(new Date(state.targetMs));
    }
    if (card) card.dataset.state = state.direction;
    if (ticker) {
      const list = cells(state, payload.unitMode);
      const key = list.map((c) => c.unit).join(',');
      if (key !== cellKey) {
        cellKey = key;
        ticker.textContent = '';
        cellEls = list.map((c) => {
          const wrap = document.createElement('div');
          wrap.className = 'ticker-cell';
          const num = document.createElement('span');
          num.className = 'ticker-num';
          const label = document.createElement('span');
          label.className = 'ticker-label';
          label.textContent = c.unit;
          wrap.append(num, label);
          ticker.append(wrap);
          return num;
        });
      }
      list.forEach((c, i) => {
        const text = c.unit === 'days' || c.unit === 'years' || c.unit === 'months' || i === 0 ? String(c.value) : pad(c.value, 2);
        if (cellEls[i].textContent !== text) cellEls[i].textContent = text;
      });
    }
    const minute = Math.floor(now() / 60000);
    if (live && minute !== lastSummaryMinute) {
      lastSummaryMinute = minute;
      live.textContent = summaryText(state, payload.unitMode);
    }
  }

  let timer = null;
  function start() {
    render();
    if (timer === null) timer = setInterval(render, 1000);
  }
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (!document.hidden) start();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage);
  else initPage();
}
