// Countdown engine and page behavior for the public link page.
// ES module, no dependencies. The pure functions are also imported by the core (page rendering) and by
// the parity test, so the top level never touches the DOM.
//
// It must give the same numbers as the Kotlin engine in :core:model (CountdownEngine). The parity test
// runs it against every vector in test/countdown-vectors.json, generated from that engine. Rules
// (docs/features/events/SPEC.md section 2.5):
// - totals (totalDays/Hours/Minutes/Seconds) are real elapsed time between two instants, floored.
// - the calendar breakdown (years..seconds) uses wall-clock fields in the event zone, with
//   end-of-month clamping (Jan 31 + 1 month = Feb 28/29), floored the same way: a fraction of a
//   second never shows as a whole one.
// - local date + time to instant: a time in a DST gap moves forward by the gap length,
//   an ambiguous time (DST overlap) takes the earlier instant.
// - a date-only event counts to 00:00:00 in its zone. timeZone null means the viewer's zone.
// - "today" means the local date in the event zone equals the occurrence date.
// - workdays count Monday to Friday by date; public holidays are not skipped.
// - unit modes: auto (days; hours and minutes below 48 hours), days, weeks, hours, calendar, workdays.

const DAY_MS = 86400000;
const AUTO_HOURS_LIMIT = 48;
const formatterCache = new Map();

/** The six unit modes, in the order the day page cycles through them. */
export const UNIT_MODES = ['auto', 'days', 'weeks', 'hours', 'calendar', 'workdays'];

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

function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Wall-clock fields of an instant in a zone, as {y, mo, d, h, mi, s, ms}. Zone offsets are whole
 * seconds, so the milliseconds are those of the instant.
 */
export function localFields(ms, zone) {
  const out = {};
  for (const p of formatterFor(zone).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour % 24, mi: out.minute, s: out.second, ms: mod(ms, 1000) };
}

/** Wall-clock fields read as a UTC timestamp ("fake UTC"). Missing time fields count as 0. */
function fake(f) {
  const t = Date.UTC(2000, f.mo - 1, f.d, f.h || 0, f.mi || 0, f.s || 0, f.ms || 0);
  const d = new Date(t);
  d.setUTCFullYear(f.y); // Date.UTC maps years 0-99 to 1900+, setUTCFullYear does not
  return d.getTime();
}

function offsetAt(ms, zone) {
  return fake(localFields(ms, zone)) - ms;
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

/** Days since 1970-01-01 of a date {y, mo, d}. */
function dayNumber(date) {
  return Math.floor(fake({ y: date.y, mo: date.mo, d: date.d }) / DAY_MS);
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
      let y = Math.max(base.y, rec.originalYear == null ? base.y : rec.originalYear, today.y);
      for (; ; y++) {
        const occ = { y, mo: base.mo, d: Math.min(base.d, daysInMonth(y, base.mo)) };
        if (cmpDate(occ, today) >= 0) return occ;
      }
    }
    case 'monthly': {
      let idx = Math.max(base.y * 12 + (base.mo - 1), today.y * 12 + (today.mo - 1));
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

/** Calendar breakdown between two wall-clock values a <= b, floored to whole seconds. */
export function breakdown(a, b) {
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

/** Monday to Friday dates in (after, upTo], given as day numbers. */
function weekdaysAfter(after, upTo) {
  const span = upTo - after;
  let count = Math.floor(span / 7) * 5;
  let day = after + Math.floor(span / 7) * 7;
  for (let i = 0; i < span % 7; i++) {
    day += 1;
    const dow = mod(day + 4, 7); // 1970-01-01 was a Thursday; 0 = Sunday
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Workdays between today and the occurrence (dates {y, mo, d}): a countdown counts the days after
 * today up to and including the occurrence, a count-up the days after the occurrence up to and
 * including today; 0 on the day itself.
 */
export function workdays(today, occurrence) {
  const t = dayNumber(today);
  const o = dayNumber(occurrence);
  if (o > t) return weekdaysAfter(t, o);
  if (o < t) return weekdaysAfter(o, t);
  return 0;
}

/**
 * Computes the countdown state for an event (shared fields of the API) at `nowMs`.
 * `viewerZone` is used when event.timeZone is null.
 */
export function compute(payload, nowMs, viewerZone) {
  const zone = payload.timeZone || viewerZone || 'UTC';
  const nowLocal = localFields(nowMs, zone);
  const today = { y: nowLocal.y, mo: nowLocal.mo, d: nowLocal.d };
  const occ = nextOccurrenceDate(payload, today);
  const time = parseTime(payload.targetTime);
  const targetLocal = { ...occ, ...time, ms: 0 };
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
    workdays: workdays(today, occ),
  };
}

/** The number a day shows in `unitMode`, in the vector file's form ({kind, ...}). */
export function unitValue(state, unitMode) {
  switch (unitMode || 'auto') {
    case 'days':
      return { kind: 'days', days: state.totalDays };
    case 'weeks':
      return { kind: 'weeksDays', weeks: Math.floor(state.totalDays / 7), days: state.totalDays % 7 };
    case 'hours':
      return { kind: 'hours', hours: state.totalHours };
    case 'calendar':
      return { kind: 'calendar', years: state.years, months: state.months, days: state.days };
    case 'workdays':
      return { kind: 'workdays', workdays: state.workdays };
    default:
      return state.totalHours < AUTO_HOURS_LIMIT
        ? { kind: 'hoursMinutes', hours: state.totalHours, minutes: state.totalMinutes % 60 }
        : { kind: 'days', days: state.totalDays };
  }
}

function plural(n, one, many) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** Short text such as "124 days to go", "22 weeks, 4 days ago" or "3 years, 4 months, 12 days to go". */
export function summaryText(state, unitMode) {
  if (state.direction === 'today' && !state.upcoming) return 'Today';
  const suffix = state.direction === 'since' ? 'ago' : 'to go';
  const v = unitValue(state, unitMode);
  let body;
  switch (v.kind) {
    case 'hoursMinutes':
      body = `${v.hours}h ${pad(v.minutes, 2)}m ${pad(state.totalSeconds % 60, 2)}s`;
      break;
    case 'weeksDays':
      body = v.weeks > 0 ? `${plural(v.weeks, 'week', 'weeks')}, ${plural(v.days, 'day', 'days')}` : plural(v.days, 'day', 'days');
      break;
    case 'hours':
      body = plural(v.hours, 'hour', 'hours');
      break;
    case 'calendar': {
      const parts = [];
      if (v.years) parts.push(plural(v.years, 'year', 'years'));
      if (v.months) parts.push(plural(v.months, 'month', 'months'));
      parts.push(plural(v.days, 'day', 'days'));
      body = parts.join(', ');
      break;
    }
    case 'workdays':
      body = plural(v.workdays, 'workday', 'workdays');
      break;
    default:
      body = plural(v.days, 'day', 'days');
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
  const clock = [
    { unit: 'minutes', value: state.totalMinutes % 60 },
    { unit: 'seconds', value: state.totalSeconds % 60 },
  ];
  if (state.direction === 'today') {
    return state.upcoming ? [{ unit: 'hours', value: state.totalHours }, ...clock] : [];
  }
  const v = unitValue(state, unitMode);
  switch (v.kind) {
    case 'hoursMinutes':
    case 'hours':
      return [{ unit: 'hours', value: state.totalHours }, ...clock];
    case 'weeksDays':
      return [
        { unit: 'weeks', value: v.weeks },
        { unit: 'days', value: v.days },
        { unit: 'hours', value: state.totalHours % 24 },
        ...clock,
      ];
    case 'calendar': {
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
    case 'workdays':
      return [{ unit: 'workdays', value: v.workdays }];
    default:
      return [{ unit: 'days', value: state.totalDays }, { unit: 'hours', value: state.totalHours % 24 }, ...clock];
  }
}

const WIDE_UNITS = new Set(['days', 'years', 'months', 'weeks', 'workdays']);

/** Unit name for a count: "days" for 2, "day" for 1. */
export function unitLabel(unit, value) {
  return value === 1 ? unit.replace(/s$/, '') : unit;
}

/**
 * Text of a ticker cell. The first cell and the day-sized units show the plain number (grouped for
 * the locale), the clock units are zero padded to two digits.
 */
export function cellText(cell, index, locale) {
  if (WIDE_UNITS.has(cell.unit) || index === 0) return cell.value.toLocaleString(locale);
  return pad(cell.value, 2);
}

/**
 * What the card shows for a state: the hero number with its unit, the smaller cells after it, and the
 * "to go" / "ago" suffix. `hero` is null on the day itself when nothing is left to count.
 */
export function display(state, unitMode) {
  const [hero, ...rest] = cells(state, unitMode);
  return { hero: hero || null, rest, suffix: state.direction === 'since' ? 'ago' : 'to go' };
}

// ---------------------------------------------------------------------------
// Browser behavior. Runs only on the public link page (element #share-data present).
// All user data reaches the DOM through textContent or CSSOM only.
// ---------------------------------------------------------------------------

const HEX = /^#[0-9A-Fa-f]{6}$/;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function platform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

function initAudio(reduceMotion) {
  const audio = document.getElementById('audio-player');
  const pill = document.getElementById('share-audio');
  const toggle = document.getElementById('audio-toggle');
  const mute = document.getElementById('audio-mute');
  const note = document.getElementById('audio-note');
  if (!audio || !pill || !toggle || !mute) return;
  pill.hidden = false;
  const idleNote = note ? note.textContent : '';

  function setPlaying(playing) {
    pill.dataset.playing = playing ? 'true' : 'false';
    toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
    toggle.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }
  function setMuted(muted) {
    audio.muted = muted;
    pill.dataset.muted = muted ? 'true' : 'false';
    mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    mute.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
  }
  function setFailed(failed) {
    pill.dataset.failed = failed ? 'true' : 'false';
    if (note) note.textContent = failed ? 'The music did not load. Try again.' : idleNote;
  }

  toggle.addEventListener('click', () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setFailed(false);
    // Playback starts only from this tap; the browser may still refuse, which the catch reports.
    audio.play().catch(() => {
      setPlaying(false);
      setFailed(true);
    });
  });
  mute.addEventListener('click', () => setMuted(!audio.muted));
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => setPlaying(false));
  audio.addEventListener('error', () => {
    setPlaying(false);
    setFailed(true);
  });
  audio.addEventListener('waiting', () => (pill.dataset.buffering = 'true'));
  audio.addEventListener('playing', () => (pill.dataset.buffering = 'false'));
  if (reduceMotion) pill.dataset.motion = 'reduced';
  setPlaying(false);
  setMuted(false);
}

function initBackdrop(reduceMotion) {
  const video = document.querySelector('.backdrop-motion');
  if (!video) return;
  if (reduceMotion) {
    // Reduced motion shows the key photo only.
    video.pause();
    video.removeAttribute('autoplay');
    video.hidden = true;
    return;
  }
  const ready = () => (video.dataset.ready = 'true');
  video.addEventListener('playing', ready);
  if (!video.paused && video.currentTime > 0) ready();
  video.addEventListener('error', () => (video.hidden = true));
  const start = video.play();
  if (start && start.catch) start.catch(() => {});
}

function initPage() {
  const blob = document.getElementById('share-data');
  if (!blob) return;
  let data;
  try {
    data = JSON.parse(blob.textContent);
  } catch {
    return;
  }
  // The public link view (GET /links/{token}) carries `event`; the old share pages carried `payload`.
  const event = data.event || data.payload;
  if (!event) return;
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Skew correction: offset between the server clock and this device's clock.
  const serverMs = Date.parse(data.serverTime);
  const skew = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
  const now = () => Date.now() + skew;

  const stage = document.getElementById('share-stage');
  const card = document.getElementById('share-card');
  const hero = document.getElementById('share-hero');
  const heroNum = document.getElementById('hero-num');
  const heroUnit = document.getElementById('hero-unit');
  const ticker = document.getElementById('share-ticker');
  const kicker = document.getElementById('share-kicker');
  const live = document.getElementById('share-live');
  const when = document.getElementById('share-when');
  const anniv = document.getElementById('share-anniversary');

  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduceMotion && card) card.dataset.motion = 'reduced';

  // Gradient: two to four hex stops. The card and the page glow around it share the value.
  const grad = event.theme && event.theme.gradient;
  if (stage && Array.isArray(grad) && grad.length >= 2 && grad.length <= 4 && grad.every((g) => HEX.test(g))) {
    stage.style.setProperty('--card-bg', `linear-gradient(145deg, ${grad.join(', ')})`);
    stage.style.setProperty('--card-glow', grad[0]);
  }

  document.body.dataset.platform = platform();
  initBackdrop(reduceMotion);
  initAudio(reduceMotion);

  let cellEls = [];
  let cellKey = '';
  let lastSummaryMinute = -1;

  function tickMotion(node) {
    if (reduceMotion || !node.animate) return;
    node.animate([{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], {
      duration: 280,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    });
  }

  function setText(node, text, animate) {
    if (node.textContent === text) return;
    node.textContent = text;
    if (animate) tickMotion(node);
  }

  // The stylesheet sizes the number by its length, so a long count (hours) still fits the card.
  function setHero(text) {
    setText(heroNum, text, false);
    heroNum.dataset.len = String(Math.min(9, text.length));
  }

  function render() {
    const state = compute(event, now(), viewerZone);
    if (kicker) {
      kicker.textContent =
        state.direction === 'today' ? 'Today is the day' : state.direction === 'since' ? 'Since' : 'Until';
    }
    if (anniv) {
      anniv.textContent = state.anniversary && state.anniversary > 0 ? `${ordinal(state.anniversary)} anniversary` : '';
      anniv.hidden = !anniv.textContent;
    }
    if (when) {
      const zone = { timeZone: state.zone };
      const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', ...zone }).format(new Date(state.targetMs));
      const time = event.targetTime
        ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short', ...zone }).format(new Date(state.targetMs))
        : '';
      when.textContent = time ? `${date} · ${time}` : date;
    }
    if (card) card.dataset.state = state.direction;
    const view = display(state, event.unitMode);
    if (hero && heroNum && heroUnit) {
      if (view.hero) {
        hero.dataset.word = 'false';
        setHero(cellText(view.hero, 0));
        setText(heroUnit, `${unitLabel(view.hero.unit, view.hero.value)} ${view.suffix}`, false);
      } else {
        hero.dataset.word = 'true';
        setHero('Today');
        setText(heroUnit, '', false);
      }
    }
    if (ticker) {
      const key = view.rest.map((c) => c.unit).join(',');
      if (key !== cellKey) {
        cellKey = key;
        ticker.textContent = '';
        cellEls = view.rest.map(() => {
          const wrap = el('div', 'tick-cell');
          const num = el('span', 'tick-num');
          const label = el('span', 'tick-label');
          wrap.append(num, label);
          ticker.append(wrap);
          return { num, label };
        });
      }
      ticker.hidden = view.rest.length === 0;
      view.rest.forEach((c, i) => {
        const cellEl = cellEls[i];
        setText(cellEl.num, cellText(c, i + 1), true);
        setText(cellEl.label, unitLabel(c.unit, c.value), false);
      });
    }
    const minute = Math.floor(now() / 60000);
    if (live && minute !== lastSummaryMinute) {
      lastSummaryMinute = minute;
      live.textContent = summaryText(state, event.unitMode);
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
