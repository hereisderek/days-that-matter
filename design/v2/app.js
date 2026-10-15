'use strict';
/* Days That Matter · design v2 prototype. Plain JS, no build step.
   One state object, one render(). Date math here is for the demo only;
   the real engine is the Kotlin one in :core:model (docs/features/events/SPEC.md).
   Rules follow the OpenSpec change pluggable-backend-live-sharing. */

const app = document.getElementById('app');
const panel = document.getElementById('panel');

// ---------- dates ----------
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const today = () => sod(new Date());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((sod(b) - sod(a)) / DAY);
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const city = tz => tz.split('/').pop().replace(/_/g, ' ');

// Month arithmetic clamps to the last day (Jan 31 + 1 month = Feb 28), always from the anchor.
function addMonths(d, n) {
  const t = d.getMonth() + n, y = d.getFullYear() + Math.floor(t / 12), m = ((t % 12) + 12) % 12;
  return new Date(y, m, Math.min(d.getDate(), daysIn(y, m)));
}

// Wall time in an IANA zone -> instant. ponytail: one-pass offset, off by the gap hour on DST switch days.
function zonedInstant(date, time, tz) {
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h, mi), p = {};
  for (const { type, value } of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(guess)) p[type] = +value;
  return new Date(2 * guess - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
}

function nextOccurrence(ev, t0) {
  const a = parse(ev.date);
  if (ev.repeat === 'none' || a >= t0) return a;
  if (ev.repeat === 'yearly' || ev.repeat === 'monthly') {
    const step = ev.repeat === 'yearly' ? 12 : 1;
    let k = Math.floor(((t0.getFullYear() - a.getFullYear()) * 12 + t0.getMonth() - a.getMonth()) / step), d;
    do d = addMonths(a, step * k++); while (d < t0);
    return d;
  }
  const step = ev.repeat === 'weekly' ? 7 : Math.max(1, ev.every || 1);
  return addDays(a, Math.ceil(diffDays(a, t0) / step) * step);
}

// Fixed zone: everyone counts to the same instant. Floating (zone null): each viewer's local time.
function calc(ev, now = new Date()) {
  const t0 = sod(now), target = nextOccurrence(ev, t0), days = diffDays(t0, target);
  let at = new Date(target);
  if (ev.zone) at = zonedInstant(target, ev.time || '00:00', ev.zone);
  else if (ev.time) { const [h, m] = ev.time.split(':'); at.setHours(+h, +m); }
  return { target, at, days: Math.abs(days), future: days > 0, past: days < 0, today: days === 0, ms: at - now };
}

function ymdBetween(a, b) {
  let k = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (addMonths(a, k) > b) k--;
  return { y: Math.floor(k / 12), m: k % 12, d: diffDays(addMonths(a, k), b) };
}

// Workdays: Monday to Friday after the start day, up to and including the end day. Public holidays are not skipped yet.
function workdays(a, b) {
  let n = 0;
  for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (d.getDay() % 6) n++;
  return n;
}

// ponytail: smoke checks for the demo math only; the shipping engine has its own test vectors.
console.assert(toISO(addMonths(new Date(2025, 0, 31), 1)) === '2025-02-28', 'month clamp');
console.assert(JSON.stringify(ymdBetween(new Date(2025, 0, 31), new Date(2025, 2, 1))) === '{"y":0,"m":1,"d":1}', 'ymd borrow');
console.assert(toISO(nextOccurrence({ date: '2020-02-29', repeat: 'yearly' }, new Date(2026, 2, 1))) === '2027-02-28', 'leap yearly');
console.assert(workdays(new Date(2026, 9, 9), new Date(2026, 9, 16)) === 5, 'workdays');
console.assert(zonedInstant(new Date(2026, 10, 19), '09:30', 'Europe/Oslo').toISOString() === '2026-11-19T08:30:00.000Z', 'zoned');

// ---------- formatting ----------
const nf = new Intl.NumberFormat('en');
const fmt = n => nf.format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const strip = s => String(s).replace(/<[^>]+>/g, '');
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
function fmtDate(d, style = 'short') {
  if (style === 'long') return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (style === 'year') return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  return d.getFullYear() === today().getFullYear()
    ? d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
const fmtTime = t => { const [h, m] = t.split(':'); return new Date(2000, 0, 1, +h, +m).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }); };
const clock = d => d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : clock(new Date(ts)); };

// ---------- catalog ----------
const CATS = [['birthday', 'Birthdays', '🎂'], ['anniversary', 'Anniversaries', '💞'], ['travel', 'Travel', '✈️'], ['holiday', 'Holidays', '🧧'], ['work', 'Work', '💼'], ['life', 'Life', '🌱']];
const REPEATS = [['none', 'Never'], ['yearly', 'Every year'], ['monthly', 'Every month'], ['weekly', 'Every week'], ['custom', 'Every N days']];
const REMINDERS = [['none', 'None'], ['day', 'On the day'], ['1d', '1 day before'], ['1w', '1 week before']];
// UnitMode: Auto (days, then h/m under 48 hours), Days, Weeks, Hours, Calendar (Y·M·D), Workdays (Mon to Fri).
const UNITS = [['auto', 'Auto'], ['days', 'Days'], ['weeks', 'Weeks'], ['hours', 'Hours'], ['calendar', 'Y·M·D'], ['workdays', 'Workdays']];
const SIZES = [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']];
const SORTS = [['smart', 'Closest first'], ['far', 'Furthest first'], ['az', 'A to Z'], ['new', 'Recently added']];
const EMOJIS = ['✨', '🎂', '💞', '🏔️', '✈️', '🧧', '🎓', '💼', '🚀', '🐶', '🌱', '🍃', '🏃', '🎄', '🏠', '👶', '💍', '📚', '💸', '🎉'];
const ACCENTS = [['jade', '#0E8F63'], ['sky', '#2A6FD6'], ['coral', '#C9472C'], ['plum', '#7547C2'], ['ink', '#1B2420']];
const MILESTONES = [100, 200, 300, 365, 500, 520, 730, 1000, 1314, 1500, 2000, 2500, 3000, 3650, 5000, 10000];
const METHODS = [['apple', 'Apple'], ['google', 'Google'], ['email', 'email']];
const methodName = m => METHODS.find(x => x[0] === m)[1];

// Built-in catalog comes from the backend (GET /api/v1/audio/catalog); 5 free tracks, the rest Premium.
const TRACKS = [
  ['gymnopedie', 'Gymnopédie No. 1', 'Erik Satie', '3:05'], ['morning', 'Morning Mood', 'Edvard Grieg', '3:41'],
  ['canon', 'Canon in D', 'Johann Pachelbel', '4:52'], ['clair', 'Clair de Lune', 'Claude Debussy', '4:58'],
  ['rain', 'Rain on Leaves', 'Field recording', '5:00'], ['nocturne', 'Nocturne Op. 9 No. 2', 'Frédéric Chopin', '4:33', 1],
  ['spring', 'Spring, I. Allegro', 'Antonio Vivaldi', '3:19', 1], ['swan', 'The Swan', 'Camille Saint-Saëns', '2:58', 1],
  ['arabesque', 'Arabesque No. 1', 'Claude Debussy', '4:21', 1],
].map(([id, title, artist, dur, premium]) => ({ id, title, artist, dur, premium: !!premium }));
const track = id => TRACKS.find(t => t.id === id);
const audioName = a => !a ? 'No music' : a.type === 'track' ? track(a.id).title : a.title;

// Smart days (draft): counted from a rule, not one date. The backend will serve holiday sets per region; this one is a sample.
const HOLIDAYS = { region: 'New Zealand (sample)', dates: ['2026-01-01', '2026-01-02', '2026-02-06', '2026-04-03', '2026-04-06', '2026-04-27', '2026-06-01', '2026-07-10', '2026-10-26', '2026-12-25', '2026-12-28'] };
const SMART = {
  year: { label: 'Days left this year', title: y => `Days left in ${y}`, emoji: '🗓️', u: 'days left this year', hint: 'With progress through the year' },
  weekends: { label: 'Weekends left this year', title: y => `Weekends left in ${y}`, emoji: '🛋️', u: 'weekends left', hint: 'Saturdays and Sundays after today' },
  holidays: { label: 'Public holidays left this year', title: y => `Public holidays left in ${y}`, emoji: '🏖️', u: 'public holidays left', hint: HOLIDAYS.region },
  workdays: { label: 'Workdays left this year', title: y => `Workdays left in ${y}`, emoji: '💼', u: 'workdays left', hint: 'Monday to Friday, minus public holidays' },
};
const holidaysLeft = () => HOLIDAYS.dates.map(parse).filter(d => d > today());
function smartCount(rule) {
  const t = today(), end = new Date(t.getFullYear(), 11, 31), hol = HOLIDAYS.dates;
  if (rule === 'year') return diffDays(t, end) + 1;
  if (rule === 'holidays') return holidaysLeft().length;
  let n = 0;
  for (let d = addDays(t, 1); d <= end; d = addDays(d, 1)) {
    const w = d.getDay();
    if (rule === 'weekends' ? w === 6 : w % 6 && !hol.includes(toISO(d))) n++;
  }
  return n;
}
const yearPct = () => { const t = today(), y0 = new Date(t.getFullYear(), 0, 1); return Math.round(diffDays(y0, t) / diffDays(y0, new Date(t.getFullYear() + 1, 0, 1)) * 100); };
// Seasonal templates: offered only inside their window (MM-DD), from a backend catalog in the real app.
const SEASONAL = [
  { id: 'halloween', title: 'Halloween', emoji: '🎃', from: '10-01', to: '10-31', fromText: 'Oct 1', toText: 'Oct 31', date: y => `${y}-10-31`, bg: { type: 'gradient', id: 'dusk' } },
  { id: 'christmas', title: 'Christmas', emoji: '🎄', from: '11-01', to: '12-25', fromText: 'Nov 1', toText: 'Dec 25', date: y => `${y}-12-25`, bg: { type: 'art', id: 'night' } },
  { id: 'lny', title: 'Lunar New Year', emoji: '🧧', from: '01-01', to: '02-06', fromText: 'Jan 1', toText: 'Feb 6', date: () => '2027-02-06', bg: { type: 'gradient', id: 'citrus' } },
];
const seedLibrary = () => [
  { id: 'lib1', title: 'Our first dance', dur: '5:30', created: 2, removed: false },
  { id: 'lib2', title: 'Happy birthday, piano', dur: '1:48', created: 1, removed: false },
];

// Plan table, mirrors docs/features/premium/SPEC.md (source of truth: :core:model).
// Remote limits configuration can change or omit limits at any time.
const CONFIG_LIMITS = {
  default: {
    free: { events: 20, photos: 5, animated: 0, files: 0, spotify: 5 },
    premium: { events: 500, photos: 300, animated: 30, files: 20, spotify: Infinity },
  },
  'no-spotify': {
    free: { events: 20, photos: 5, animated: 0, files: 0 },
    premium: { events: 500, photos: 300, animated: 30, files: 20 },
  },
};
const getLimits = (plan = S.plan) => {
  const cfg = CONFIG_LIMITS[S.limitsConfig || 'default'] || CONFIG_LIMITS.default;
  return cfg[plan];
};
const LIMITS = new Proxy({}, {
  get: (_, prop) => getLimits(prop),
});
const WALLS = {
  events: ['Free includes 20 events', 'Premium keeps up to 500. Nothing you have is ever deleted.', 'events'],
  photos: ['Free includes 5 photo backdrops', 'Premium includes 300, and 30 animated photos.', 'photo backdrops'],
  animated: ['Animated photos are part of Premium', 'Preview it as much as you like. Saving it needs Premium.', 'animated photos'],
  premium_audio: ['This track is part of Premium', 'Free includes 5 tracks. Premium unlocks the whole catalog.', 'tracks'],
  files: ['Your own music is part of Premium', 'Add up to 20 songs. They are converted on your phone.', 'music files'],
  spotify: ['Free includes Spotify on 5 events', 'Premium has no Spotify limit.', 'Spotify events'],
};

const COLORS = [
  ['Mint', '#CDEFDF'], ['Sky', '#CFE5F8'], ['Peach', '#FADDCB'], ['Lilac', '#E2DBF6'], ['Butter', '#F7ECB9'], ['Blush', '#F6D3DC'], ['Sage', '#D9E3D0'], ['Mist', '#E5E8EC'],
  ['Jade', '#0E7F5A'], ['Ocean', '#2D6CDF'], ['Coral', '#C8472E'], ['Plum', '#7B4CC6'], ['Marigold', '#F0B429'], ['Forest', '#1F3D33'], ['Ink', '#18201C'], ['Paper', '#FBFAF6'],
];
const mesh = (a, b, c, base) => `radial-gradient(120% 90% at 8% 6%, ${a} 0, transparent 62%), radial-gradient(90% 85% at 96% 4%, ${b} 0, transparent 60%), radial-gradient(110% 90% at 70% 104%, ${c} 0, transparent 66%), ${base}`;
const GRADS = {
  lagoon: { name: 'Lagoon', base: '#E3F4EE', css: mesh('#C2F1E0', '#BCDDFF', '#DAF6C6', '#E3F4EE') },
  morning: { name: 'Morning', base: '#FFEDE6', css: mesh('#FFE0C9', '#FFCDDB', '#D9E0FF', '#FFEDE6') },
  meadow: { name: 'Meadow', base: '#EBF6DA', css: mesh('#E8F7BE', '#B2E9CD', '#FFF2BF', '#EBF6DA') },
  glacier: { name: 'Glacier', base: '#E7F0FF', css: mesh('#E0EEFF', '#C3D5FF', '#E2FAFF', '#E7F0FF') },
  citrus: { name: 'Citrus', base: '#FFE6C4', css: mesh('#FFEF98', '#FFB585', '#FFD9BB', '#FFE6C4') },
  dusk: { name: 'Dusk', base: '#3F3787', css: mesh('#FF9A8B', '#7C6CF0', '#2B377F', '#3F3787') },
  deep: { name: 'Deep sea', base: '#0E3C4E', css: mesh('#1C9E74', '#0E5C70', '#0A2C45', '#0E3C4E') },
  berry: { name: 'Berry', base: '#6E45B8', css: mesh('#F28DB0', '#A479E8', '#5A3BAF', '#6E45B8') },
};
const ART = {
  hills: { name: 'Hills', base: '#D8EFE2', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#DDF1FF'/><stop offset='1' stop-color='#F4FAF1'/></linearGradient></defs><rect width='400' height='300' fill='url(#s)'/><circle cx='300' cy='88' r='34' fill='#FFE7A3'/><path d='M0 190 C80 150 140 205 220 180 S340 140 400 165 V300 H0Z' fill='#CBEBD6'/><path d='M0 230 C90 195 170 245 260 220 S360 200 400 215 V300 H0Z' fill='#A3DABB'/><path d='M0 268 C110 245 210 280 300 260 S380 252 400 258 V300 H0Z' fill='#7CC9A0'/></svg>` },
  sunrise: { name: 'Sunrise', base: '#FFE8DA', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><rect width='400' height='300' fill='#FFF2E8'/><circle cx='200' cy='200' r='118' fill='#FFDCC6'/><circle cx='200' cy='200' r='80' fill='#FFC3A1'/><rect y='200' width='400' height='100' fill='#FFE8DA'/><rect y='222' width='400' height='5' fill='#FFF6EF'/><rect y='244' width='400' height='7' fill='#FFF6EF'/><rect y='270' width='400' height='9' fill='#FFF6EF'/></svg>` },
  tide: { name: 'Tide', base: '#CFE4F7', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><rect width='400' height='300' fill='#EEF6FD'/><path d='M0 120 Q50 98 100 120 T200 120 T300 120 T400 120 V300 H0Z' fill='#DCEBF9'/><path d='M0 170 Q50 148 100 170 T200 170 T300 170 T400 170 V300 H0Z' fill='#C5DEF5'/><path d='M0 220 Q50 198 100 220 T200 220 T300 220 T400 220 V300 H0Z' fill='#AACDEF'/><path d='M0 262 Q50 244 100 262 T200 262 T300 262 T400 262 V300 H0Z' fill='#8EBBE7'/></svg>` },
  petals: { name: 'Petals', base: '#FBEEF2', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><rect width='400' height='300' fill='#FCF2F5'/><ellipse cx='70' cy='60' rx='74' ry='46' fill='#F8D5E0' transform='rotate(-20 70 60)'/><ellipse cx='345' cy='70' rx='84' ry='50' fill='#E7DCFA' transform='rotate(25 345 70)'/><ellipse cx='310' cy='255' rx='94' ry='54' fill='#FFE2D1' transform='rotate(-15 310 255)'/><ellipse cx='80' cy='255' rx='64' ry='40' fill='#DCF1E5' transform='rotate(30 80 255)'/></svg>` },
  confetti: { name: 'Confetti', base: '#F6FAF4', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><defs><pattern id='p' width='64' height='64' patternUnits='userSpaceOnUse'><circle cx='10' cy='12' r='4' fill='#8ED9B8'/><circle cx='44' cy='30' r='3' fill='#FFB59A'/><rect x='22' y='44' width='9' height='9' rx='2' fill='#A9CBFF' transform='rotate(20 26 48)'/><circle cx='56' cy='56' r='2.5' fill='#F7C948'/><path d='M50 6 q4 4 0 8' stroke='#C9B6F5' stroke-width='2.5' fill='none' stroke-linecap='round'/></pattern></defs><rect width='400' height='300' fill='#F6FAF4'/><rect width='400' height='300' fill='url(#p)'/></svg>` },
  night: { name: 'Night', base: '#1D2650', svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='n' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#141B3A'/><stop offset='1' stop-color='#33407A'/></linearGradient></defs><rect width='400' height='300' fill='url(#n)'/><circle cx='305' cy='78' r='28' fill='#FFF3D1'/><circle cx='318' cy='70' r='25' fill='#18204A'/><g fill='#fff'><circle cx='60' cy='50' r='1.4'/><circle cx='120' cy='96' r='1'/><circle cx='190' cy='40' r='1.6'/><circle cx='240' cy='120' r='1'/><circle cx='360' cy='150' r='1.3'/><circle cx='90' cy='150' r='1.2'/><circle cx='30' cy='110' r='.9'/></g><path d='M0 250 Q100 218 200 244 T400 236 V300 H0Z' fill='#10163A'/></svg>` },
};
const FONTS = { sans: 'Modern', serif: 'Serif', rounded: 'Rounded', mono: 'Mono', condensed: 'Poster' };
const STYLES = { glass: ['Glass', 'Frosted chips'], clean: ['Clean', 'Flat, no effects'], outline: ['Outline', 'Light card, colored edge'], poster: ['Poster', 'Oversized number'] };
// Sample photos. "live" ones stand in for iPhone Live Photos / Google Motion Photos (simulated motion).
const PHOTOS = [[1015], [129], [1025], [17], [106], [152, 1], [189, 1], [16, 1], [54], [1043], [56]];
const pic = id => `https://picsum.photos/id/${id}/1000/1000`;
const thumb = id => `https://picsum.photos/id/${id}/240/320`;

// ---------- looks & contrast ----------
const svgURL = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
function bgCSS(bg) {
  switch (bg.type) {
    case 'color': return bg.value;
    case 'gradient': return GRADS[bg.id].css;
    case 'art': return `${svgURL(ART[bg.id].svg)} center / cover no-repeat, ${ART[bg.id].base}`;
    default: return `url("${bg.src}") ${bg.fx ?? 50}% ${bg.fy ?? 50}% / cover no-repeat, #4F6B62`;
  }
}
const baseColor = bg => bg.type === 'color' ? bg.value : bg.type === 'gradient' ? GRADS[bg.id].base : bg.type === 'art' ? ART[bg.id].base : '#3A4A44';
const edgeColor = bg => bg.type === 'photo' ? '#8FA39A' : baseColor(bg);
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
// Auto text color: whichever of white / ink has more contrast on the dimmed base color (0.2 is the crossover).
const effLum = look => lum(baseColor(look.bg)) * (1 - look.dim);
const tone = look => look.text !== 'auto' ? look.text : effLum(look) > .2 ? 'dark' : 'light';
function contrastInfo(look) {
  if (look.bg.type === 'photo') return { ok: true, text: 'Photo: scrim plus soft text shadow keep text at 4.5:1. Raise Darken for busy photos.' };
  const r = ratio(effLum(look), tone(look) === 'dark' ? lum('#111714') : 1);
  return { ok: r >= 4.5, text: `${r.toFixed(1)} : 1 contrast · ${r >= 4.5 ? 'passes AA' : r >= 3 ? 'large text only' : 'too low, try Auto'}` };
}
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

// ---------- seed ----------
function seed() {
  const t = today(), rel = n => toISO(addDays(t, n));
  const yearsAgo = (n, y) => { const d = addDays(t, n); return toISO(new Date(d.getFullYear() - y, d.getMonth(), d.getDate())); };
  const look = (bg, o = {}) => ({ bg, dim: bg.type === 'photo' ? .25 : 0, blur: 0, style: 'glass', font: 'sans', text: 'auto', size: 'md', ...o });
  return [
    { id: 'norway', title: 'Norway trip', emoji: '🏔️', date: rel(38), time: '09:30', zone: 'Europe/Oslo', category: 'travel', pinned: true, pinnedAt: 3, created: rel(-62), reminder: '1w',
      notes: 'Rain jackets. Train seats 41 and 42.', audio: { type: 'track', id: 'morning' },
      look: look({ type: 'photo', src: pic(1015), fx: 50, fy: 62 }),
      members: [{ name: 'Lin', role: 'editor' }, { name: 'Jon', role: 'viewer' }], removed: [{ name: 'Sam' }],
      links: [{ label: 'Family chat', token: 'Q7fK2mXw9pLs0aRt4vYb8c', expires: 'Never' }],
      invites: [{ role: 'editor', uses: 5, used: 2, expires: fmtDate(addDays(t, 30)), token: 'Hn3kV0aQ8sLm2PzW5yTc1e' }],
      memos: [{ date: rel(-20), text: 'Booked the night train from Oslo to Bergen.' }] },
    { id: 'mia', title: "Mia's birthday", emoji: '🎂', date: yearsAgo(23, 7), repeat: 'yearly', category: 'birthday', pinned: true, pinnedAt: 1, audio: { type: 'file', id: 'lib2', title: 'Happy birthday, piano', dur: '1:48' }, look: look({ type: 'color', value: '#FADDCB' }, { style: 'clean', font: 'rounded' }) },
    { id: 'together', title: 'Together', emoji: '💞', date: '2021-05-20', category: 'anniversary', unit: 'days', pinned: true, pinnedAt: 2,
      audio: { type: 'spotify', kind: 'Playlist', title: 'Our songs', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W' },
      look: look({ type: 'photo', src: pic(129), fx: 50, fy: 55 }, { font: 'serif', dim: .22, size: 'lg' }),
      memos: [{ date: '2021-05-20', text: 'First walk along the river. It rained the whole time.', tag: 'Day 1' },
        { date: '2024-02-13', text: 'Day 1,000. Dumplings at the place we found on day 3.', tag: 'Day 1,000' },
        { date: rel(-40), text: 'Planted the lemon tree on the balcony.' }] },
    { id: 'grandma', title: "Grandma's 90th", emoji: '🎉', date: rel(64), time: '12:00', owner: { name: 'Mum' }, role: 'editor',
      audio: { type: 'track', id: 'nocturne' }, members: [{ name: 'Dad', role: 'editor' }, { name: 'You', role: 'editor' }, { name: 'Ana', role: 'viewer' }],
      look: look({ type: 'photo', src: pic(152), fx: 50, fy: 50, animated: true, canAnimate: true }, { font: 'serif', dim: .28 }) },
    { id: 'payday', title: 'Payday', emoji: '💸', date: toISO(new Date(2025, 0, t.getDate())), repeat: 'monthly', category: 'work', look: look({ type: 'art', id: 'confetti' }, { style: 'clean', size: 'sm' }) },
    { id: 'launch', title: 'App launch', emoji: '🚀', date: rel(49), time: '10:00', zone: DEVICE_TZ, category: 'work', unit: 'workdays', look: look({ type: 'color', value: '#2D6CDF' }, { style: 'outline', font: 'mono' }) },
    { id: 'mochi', title: 'Mochi came home', emoji: '🐶', date: '2024-03-09', category: 'life', look: look({ type: 'photo', src: pic(1025), fx: 50, fy: 45 }, { font: 'rounded' }),
      memos: [{ date: '2024-03-09', text: 'Slept the whole ride home.', tag: 'Day 1' }] },
    { id: 'marathon', title: 'Spring marathon', emoji: '🏃', date: rel(158), category: 'life', unit: 'weeks', look: look({ type: 'art', id: 'hills' }, { style: 'poster', font: 'condensed' }) },
    { id: 'weekends', kind: 'smart', rule: 'weekends', title: `Weekends left in ${t.getFullYear()}`, emoji: '🛋️', date: toISO(new Date(t.getFullYear(), 11, 31)), reminder: 'none',
      look: look({ type: 'gradient', id: 'meadow' }, { size: 'sm' }) },
    { id: 'test', title: 'Driving test', emoji: '🚗', date: rel(-120), category: 'life', archived: true, look: look({ type: 'color', value: '#CFE5F8' }) },
  ].map(fillEvent);
}
const fillEvent = (e, i) => ({ kind: 'date', rule: null, archived: false, repeat: 'none', every: 10, time: null, zone: null, pinned: false, pinnedAt: 0, unit: 'auto', created: toISO(addDays(today(), -30 - i)), reminder: 'day', audio: null,
  notes: '', memos: [], owner: null, role: 'owner', members: [], removed: [], links: [], invites: [], ...e });
// Days kept on this device in local mode (own database, separate from any account's). Four days, three memos.
function seedLocal() {
  const t = today(), rel = n => toISO(addDays(t, n));
  const look = (bg, o = {}) => ({ bg, dim: 0, blur: 0, style: 'glass', font: 'sans', text: 'auto', size: 'md', ...o });
  return [
    { id: 'l-japan', title: 'Japan 2027', emoji: '🗼', date: rel(142), category: 'travel', pinned: true, pinnedAt: 1, look: look({ type: 'gradient', id: 'glacier' }) },
    { id: 'l-dad', title: 'Dad’s retirement party', emoji: '🥂', date: rel(21), time: '18:30', category: 'life', look: look({ type: 'gradient', id: 'citrus' }, { style: 'clean' }),
      memos: [{ date: rel(-6), text: 'Booked the back room. Ask Aunt Li about the cake.' }] },
    { id: 'l-bread', title: 'Sourdough starter', emoji: '🍞', date: rel(-210), category: 'life', look: look({ type: 'color', value: '#F7ECB9' }, { style: 'clean', font: 'rounded' }),
      memos: [{ date: rel(-120), text: 'First loaf that rose properly.', tag: null }, { date: rel(-30), text: 'Shared a jar with the neighbours.' }] },
    { id: 'l-5k', title: 'First 5K', emoji: '🏃', date: rel(-48), category: 'life', look: look({ type: 'art', id: 'hills' }, { style: 'poster', font: 'condensed', size: 'sm' }) },
  ].map(fillEvent);
}
const seedHistory = () => ({
  norway: [
    { rev: 14, by: 'Lin', when: '2 hours ago', changes: [['Time', '9:00 AM', '9:30 AM']] },
    { rev: 13, by: 'You', when: 'Yesterday', changes: [['Backdrop', 'Color · Sky', 'Photo']] },
    { rev: 12, by: 'You', when: 'Oct 2', ownerOnly: true, changes: [['Notes', '—', 'Rain jackets. Train seats 41 and 42.']] },
    { rev: 9, by: 'Lin', when: 'Sep 28', changes: [['Music', 'No music', 'Morning Mood']] },
    { rev: 3, by: 'You', when: 'Aug 11', changes: [['Title', 'Oslo', 'Norway trip'], ['Emoji', '✈️', '🏔️']] },
  ],
  grandma: [
    { rev: 7, by: 'Mum', when: 'Today', changes: [['Backdrop', 'Still photo', 'Animated photo']] },
    { rev: 6, by: 'You', when: 'Yesterday', changes: [['Time', 'All day', '12:00 PM']] },
    { rev: 2, by: 'Dad', when: 'Sep 30', changes: [['Title', "Mum's mum 90", "Grandma's 90th"]] },
  ],
});

// ---------- state ----------
const ACCOUNT = { name: 'Alex', email: 'alex@example.com', methods: ['apple'] };
const S = {
  screen: 'home', stack: [], anim: '', accountEvents: seed(), localEvents: seedLocal(), history: seedHistory(),
  // account null = local mode (no sign-in). Local days and an account's days live in separate stores; only an explicit import moves days.
  account: { ...ACCOUNT }, localName: 'Sam', plan: 'free', lastSync: Date.now() - 4 * 6e4, pending: 0,
  importChoice: 'skipped', importResult: 'ok', limitsConfig: 'default', widgetMode: 'normal', unsyncedChanges: 'none', afterImport: null, nudgeNo: 0, clockHour: null, // importChoice: none (not asked yet), imported, skipped
  filter: 'all', layout: 'list', sort: 'smart', query: '', searching: false,
  detailId: 'norway', playing: false, motion: false, pinIndex: 0,
  draft: null, edTab: 'details', bgTab: 'photo', soundTab: 'builtin', prevCtx: 'hero', trackPreview: null,
  share: { tab: 'link', format: 'story', watermark: true, newLink: false, linkLabel: '', linkExpiry: 'never', inviteRole: 'editor', inviteUses: '5', inviteExpiry: '30' },
  sheet: null, dialog: null, toast: null, after: null, billing: 'year',
  library: seedLibrary(), config: { memoBadge: 'top-right' }, // config = remote config from GET /config
  settings: { greeting: true, theme: 'system', accent: 'jade', dayOne: false, weekStart: 'mon', showHero: true, widgetStyle: 'match', notify: true, notifyShared: true, notifyAdded: true, notifyOffers: false },
};
// S.events is whichever store is active: the signed-in account's days, or the days kept on this device in local mode.
Object.defineProperty(S, 'events', { get: () => S.account ? S.accountEvents : S.localEvents, set: v => { if (S.account) S.accountEvents = v; else S.localEvents = v; } });
// Local mode has no backend: no shared-with-me days, no links, no history.
const visible = () => S.events.filter(e => S.account || !e.owner);
const byId = id => S.events.find(e => e.id === id);
// Archived days leave Home, the pinned carousel and widget choices; they live on the Archived screen.
const active = () => visible().filter(e => !e.archived);
const libUsedBy = id => S.events.filter(e => e.audio?.type === 'file' && e.audio.id === id).length;
// Pinned days, most recently pinned first. Pin is owner-only, so days shared with you can't be pinned.
const pins = () => active().filter(e => e.pinned && !e.owner).sort((a, b) => b.pinnedAt - a.pinnedAt);
const isOwner = ev => !ev.owner;
const role = ev => ev.owner ? ev.role : 'owner';
const sharedOut = ev => !!S.account && isOwner(ev) && (ev.members.length > 0 || ev.links.length > 0);
const scrollMem = {};
const first = s => Array.from(s || '')[0] || '';
const initial = () => first(S.account?.name || S.account?.email || 'Y').toUpperCase();
const localCount = () => ({ days: S.localEvents.length, memos: S.localEvents.reduce((n, e) => n + e.memos.length, 0) });
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// Home greeting: morning 5 to 11, afternoon 12 to 16, evening 17 to 21, late night 22 to 4. No name, no comma.
const dayPart = () => { const h = S.clockHour ?? new Date().getHours(); return h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'late'; };
function greeting() {
  const name = (S.account ? S.account.name : S.localName).trim(), part = dayPart();
  if (part === 'late') return name ? `Still up, ${name}?` : 'Still up?';
  return `Good ${part}${name ? `, ${name}` : ''}`;
}
function usage(except) {
  const mine = S.events.filter(e => isOwner(e) && e.id !== except);
  return { events: mine.length, photos: mine.filter(e => e.look.bg.type === 'photo').length, animated: mine.filter(e => e.look.bg.animated).length,
    files: S.library.filter(l => !l.removed || libUsedBy(l.id)).length, // a song counts while in the library or used by a day
     spotify: mine.filter(e => e.audio?.type === 'spotify').length };
}

// ---------- values ----------
function occurrence(ev, c) {
  if (ev.repeat === 'yearly') {
    const n = c.target.getFullYear() - parse(ev.date).getFullYear();
    if (n > 0) return ev.category === 'birthday' ? `turns ${n}` : `${ordinal(n)} anniversary`;
  }
  return { monthly: 'Monthly', weekly: 'Weekly', custom: `Every ${ev.every} days` }[ev.repeat] || '';
}

function valueFor(ev, unit, c) {
  if (ev.kind === 'smart') return { num: fmt(smartCount(ev.rule)), u: SMART[ev.rule].u };
  if (c.today) return { num: 'Today', u: ev.repeat === 'yearly' ? occurrence(ev, c) : 'it’s the day', today: true };
  const dir = c.future ? 'left' : 'since', [a, b] = c.future ? [today(), c.target] : [c.target, today()];
  if (unit === 'weeks') return { num: `${Math.floor(c.days / 7)}<small>w</small>${c.days % 7}<small>d</small>`, u: c.future ? 'to go' : 'since', long: true };
  if (unit === 'hours') return { num: fmt(Math.floor(Math.abs(c.ms) / 36e5)), u: `hours ${dir}` };
  if (unit === 'workdays') return { num: fmt(workdays(a, b)), u: `workdays ${dir}` };
  if (unit === 'calendar') {
    const { y, m, d } = ymdBetween(a, b);
    const parts = [[y, 'y'], [m, 'm'], [d, 'd']].filter(([n], i) => n || i === 2 || (i === 1 && y));
    return { num: parts.map(([n, s]) => `${n}<small>${s}</small>`).join(''), u: c.future ? 'to go' : 'since', long: true };
  }
  if (unit === 'auto' && c.future && c.ms > 0 && c.ms < 48 * 36e5) {
    const h = Math.floor(c.ms / 36e5), m = Math.floor(c.ms % 36e5 / 6e4);
    return { num: `${h}<small>h</small>${pad(m)}<small>m</small>`, u: 'to go', long: true };
  }
  if (!c.future && S.settings.dayOne) return { pre: 'Day', num: fmt(c.days + 1), u: 'and counting' };
  return { num: fmt(c.days), u: `${c.days === 1 ? 'day' : 'days'} ${dir}` };
}

const smartMeta = ev => `Until Dec 31${ev.rule === 'holidays' ? ` · ${HOLIDAYS.region}` : ''}`;
function meta(ev, c) {
  if (ev.kind === 'smart') return smartMeta(ev);
  if (c.past) return `Since ${fmtDate(c.target, 'year')}`;
  return [c.today ? 'Today' : fmtDate(c.target), occurrence(ev, c)].filter(Boolean).join(' · ');
}
function metaLong(ev, c, long = true) {
  if (ev.kind === 'smart') return `Counts to December 31, ${c.target.getFullYear()}${ev.rule === 'holidays' ? ` · ${HOLIDAYS.region}` : ''}`;
  let s = `${c.past ? 'Since ' : ''}${fmtDate(c.target, long ? 'long' : 'short')}`;
  if (ev.time) s += ` · ${fmtTime(ev.time)}`;
  if (ev.zone && ev.zone !== DEVICE_TZ) s += ` ${city(ev.zone)} time${ev.time && long ? ` (${clock(c.at)} here)` : ''}`;
  return s;
}

function tickText(ev) {
  if (ev.kind === 'smart') return `${yearPct()}% of ${today().getFullYear()} done`;
  const c = calc(ev);
  if (c.today && c.ms <= 0) return 'Happening today';
  let ms = Math.abs(c.ms);
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.floor(ms / 6e4), s = Math.floor((ms - m * 6e4) / 1e3);
  return `${fmt(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

// ---------- icons ----------
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 13.5V21"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v6a3 3 0 003 3h8a3 3 0 003-3v-6"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  edit: '<path d="M4 20h4L19.3 8.7a2.1 2.1 0 00-3-3L5 17v3z"/><path d="M14.5 7.5l2 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  list: '<rect x="4" y="5" width="16" height="5.5" rx="2"/><rect x="4" y="13.5" width="16" height="5.5" rx="2"/>',
  sort: '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>', user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0114 0"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0111 0"/><path d="M15.5 5.5a3.2 3.2 0 010 6.2M17.5 19.5a5.5 5.5 0 00-2.2-4.4"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  memo: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M9 9h6M9 12.5h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>', upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 20h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  palette: '<path d="M12 3a9 9 0 000 18c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.8-2.4H18a3 3 0 003-3c0-5.5-4-10.5-9-10.5z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/>',
  archive: '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/>',
  bell: '<path d="M6 16v-5a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>', calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  widgets: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="16" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.8 4.8 0 01-1 9.5z"/>', globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 2.5 14.3 0 17M12 3.5c-2.5 2.7-2.5 14.3 0 17"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4.5 7l7.5 6 7.5-6"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>', image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
  sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/>', duplicate: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M4 16V7a3 3 0 013-3h9"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>', send: '<path d="M5 12h13M13 6l6 6-6 6"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 102.2-5.3"/><path d="M4 4.5v4h4M12 8v4l3 2"/>', flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  leave: '<path d="M14 4h3.5A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5H14M10 16l-4-4 4-4M6 12h10"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.6c3-1 6.6-.7 9.2.9M8 12.7c2.5-.7 5.3-.4 7.5.9M8.6 15.6c2-.5 4.1-.3 5.8.6"/>',
  zone: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>', briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7M3.5 12.5h17"/>',
  restore: '<path d="M4 12a8 8 0 108-8"/><path d="M8 4H4v4"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const proBadge = () => '<span class="pro">Premium</span>';

// ---------- card ----------
// motion: play an animated backdrop once (day page on open, editor preview). Lists and widgets show the key photo.
function layers(L, motion = false) {
  // Blur is a shared look field (backdrop.blur, 0 to 16) for photos and art.
  const blur = L.blur && (L.bg.type === 'photo' || L.bg.type === 'art') ? `--b:blur(${L.blur}px);inset:-${L.blur * 2}px;` : '';
  return `<div class="card-bg${motion && L.bg.animated ? ' motion' : ''}" style="${esc(`background:${bgCSS(L.bg)};${blur}`)}"></div>`
    + (L.dim ? `<div class="card-scrim" style="opacity:${L.dim}"></div>` : '')
    + (L.bg.type === 'photo' ? '<div class="card-legible"></div>' : '')
    + '<div class="card-grain"></div>';
}
const count = v => `${v.pre ? `<span class="pre">${v.pre}</span>` : ''}<span class="num${v.long ? ' long' : ''}">${v.num}</span>`;
const cardClass = (ev, ctx, style = ev.look.style) => `card ctx-${ctx} st-${style} tone-${tone(ev.look)} font-${ev.look.font} size-${ev.look.size || 'md'}`;
// Owner-only: memos never reach members or the web. Position comes from remote config (ui.memoBadge).
const memoBadge = ev => isOwner(ev) && ev.memos.length ? `<span class="memo-badge ${S.config.memoBadge}" aria-label="${ev.memos.length} memos">${icon('memo')}${ev.memos.length > 9 ? '9+' : ev.memos.length}</span>` : '';
const cardVars = L => esc(`--swatch:${bgCSS(L.bg)};--edge:${edgeColor(L.bg)}`);
const title = ev => esc(ev.title || 'Untitled day');
const marks = ev => (ev.pinned ? icon('pin', 'mini') : '') + (ev.owner ? `${icon('people', 'mini')}${esc(ev.owner.name)} · ` : sharedOut(ev) ? icon('people', 'mini') : '');
const watermark = () => S.share.watermark ? '<div class="mark">Tracked with Days That Matter</div>' : '';

const CTX = {
  row: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div class="txt"><div class="t">${title(ev)}</div><div class="m">${marks(ev)}${esc(meta(ev, c))}</div>${ev.look.size === 'lg' ? `<div class="m tick" data-tick="${ev.id}">${tickText(ev)}</div>` : ''}</div><div class="cnt">${count(v)}<div class="u">${v.u}</div></div>`,
  tile: (ev, c, v) => `<div class="top"><span class="emo">${ev.emoji}</span><span class="m">${marks(ev).replace(/ · $/, '')}</span></div><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(ev)}</div><div class="m">${esc(meta(ev, c))}</div></div>`,
  hero: (ev, c, v) => `<div class="top"><span class="glass-pill">${ev.pinned ? `${icon('pin', 'mini')}Pinned` : esc(catOf(ev)[1])}</span><span class="emo">${ev.emoji}</span></div>
    <div><div class="t">${title(ev)}</div><div class="m">${esc(metaLong(ev, c, false))}</div>
    <div class="row"><div class="h-count">${count(v)}<span class="u">${v.u}</span></div><span class="glass-pill tick" data-tick="${ev.id}">${tickText(ev)}</span></div></div>`,
  mini: (ev, c, v) => `<span class="emo">${ev.emoji}</span>${count(v)}`,
  ws: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(ev)}</div></div>`,
  story: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div class="t">${title(ev)}</div>${count(v)}<div class="u">${v.u}</div><div class="m">${esc(fmtDate(c.target, 'year'))}</div>${watermark()}`,
  banner: (ev, c, v) => `<div><span class="emo">${ev.emoji}</span><div class="t">${title(ev)}</div><div class="m">${esc(fmtDate(c.target, 'year'))}</div></div><div class="cnt">${count(v)}<div class="u">${v.u}</div></div>${watermark()}`,
};

function card(ev, ctx, attrs = '', motion = false) {
  const c = calc(ev), v = valueFor(ev, ev.unit, c);
  const style = ['story', 'banner'].includes(ctx) && ev.look.style === 'outline' ? 'clean' : ev.look.style;
  return `<article class="${cardClass(ev, ctx, style)}" style="${cardVars(ev.look)}" ${attrs}>${layers(ev.look, motion)}${['row', 'tile', 'hero'].includes(ctx) ? memoBadge(ev) : ''}<div class="card-body">${CTX[ctx](ev, c, v)}</div></article>`;
}
function openAttrs(ev, act = 'open', arg = ev.id) {
  const v = valueFor(ev, ev.unit, calc(ev));
  return `data-act="${act}" data-arg="${arg}" data-long="${ev.id}" role="button" tabindex="0" aria-label="${esc(`${ev.title}, ${strip(v.pre || '')} ${strip(v.num)} ${strip(v.u)}${ev.owner ? `, shared by ${ev.owner.name}` : ''}`)}"`;
}
const catOf = ev => ev.kind === 'smart' ? ['smart', 'Smart day', '✨'] : CATS.find(c => c[0] === ev.category) || ['shared', 'Shared', '👥'];

// ---------- views ----------
function statusbar() {
  const ev = S.screen === 'detail' && byId(S.detailId);
  const light = (ev && tone(ev.look) === 'light') || isDark();
  const veil = !['detail', 'onboarding', 'choice'].includes(S.screen) ? 'veil' : '';
  return `<div class="statusbar ${light ? 'on-dark' : ''} ${veil}" aria-hidden="true"><span class="sb-time">${clock(new Date()).replace(/\s?[AP]M/, '')}</span><span class="sb-icons">
    <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 16 12"><path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.3-1.4A10.3 10.3 0 008 .4 10.3 10.3 0 00.7 3.4L2 4.8a8.4 8.4 0 016-2.4zm0 4c1.2 0 2.3.5 3.2 1.2l1.3-1.4A6.6 6.6 0 008 4.4 6.6 6.6 0 003.5 6.2l1.3 1.4C5.7 6.9 6.8 6.4 8 6.4zm0 4.2 1.9-2A2.8 2.8 0 008 8a2.8 2.8 0 00-1.9.6z"/></svg>
    <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="24.5" y="4" width="1.8" height="4" rx=".9" opacity=".4"/></svg>
  </span></div><div class="island"></div>`;
}

function sortRows(rows) {
  const by = { smart: (a, b) => a.c.days - b.c.days, far: (a, b) => b.c.days - a.c.days, az: (a, b) => a.e.title.localeCompare(b.e.title), new: (a, b) => b.e.created.localeCompare(a.e.created) }[S.sort];
  return rows.sort(by);
}

function homeView() {
  const q = S.query.trim().toLowerCase(), pinned = S.settings.showHero && !q && S.filter === 'all' ? pins() : [];
  S.pinIndex = Math.min(S.pinIndex, Math.max(0, pinned.length - 1));
  let rows = active().map(e => ({ e, c: calc(e) }));
  if (q) rows = rows.filter(r => r.e.title.toLowerCase().includes(q));
  if (S.filter === 'shared') rows = rows.filter(r => r.e.owner || sharedOut(r.e));
  if (S.filter === 'smart') rows = rows.filter(r => r.e.kind === 'smart');
  if (CATS.some(c => c[0] === S.filter)) rows = rows.filter(r => r.e.category === S.filter);
  const up = sortRows(rows.filter(r => !r.c.past)), since = sortRows(rows.filter(r => r.c.past));
  const sections = [S.filter !== 'since' && ['Upcoming', up], S.filter !== 'upcoming' && ['Since', since]].filter(s => s && s[1].length);
  const filters = [['all', 'All'], ['upcoming', 'Upcoming'], ['since', 'Since'], ...(S.account ? [['shared', 'Shared']] : []), ['smart', 'Smart'], ...CATS.map(([k, n]) => [k, n])];
  const tools = `<div class="tools"><button data-act="layout" aria-label="${S.layout === 'list' ? 'Show as grid' : 'Show as list'}">${icon(S.layout === 'list' ? 'grid' : 'list')}</button><button data-act="sort-menu" aria-label="Sort">${icon('sort')}</button></div>`;
  const ctx = S.layout === 'grid' ? 'tile' : 'row', nArch = visible().filter(e => e.archived).length;
  const kicker = S.account && S.pending ? `<span class="sync-dot"></span>Syncing ${S.pending} ${S.pending === 1 ? 'change' : 'changes'}…` : new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  const carousel = !pinned.length ? '' : `<div class="pins-wrap">
      <div class="pins${pinned.length > 1 ? ' multi' : ''}" aria-roledescription="carousel" aria-label="Pinned days">${pinned.map((e, i) =>
        `<div class="pin-slot">${card(e, 'hero', openAttrs(e, 'pin-card', i))}</div>`).join('')}</div>
      ${pinned.length > 1 ? `<div class="dots">${pinned.map((e, i) => `<button class="dot" data-act="pin-go" data-arg="${i}" aria-label="Show ${esc(e.title)}" aria-current="${i === S.pinIndex}"></button>`).join('')}</div>` : ''}</div>`;
  return `<section class="view home" data-key="home"><div class="home-top">
    <header class="home-head">
      <div><div class="kicker">${kicker}</div>${S.settings.greeting ? `<h1 class="h1 greet" data-part="${dayPart()}">${esc(greeting())}</h1>` : '<h1 class="h1">Your days</h1>'}</div>
      <div class="head-btns"><button class="icon-btn" data-act="search" aria-label="Search">${icon('search')}</button><button class="icon-btn ${S.account ? 'av-btn' : ''}" data-act="go" data-arg="settings" aria-label="Settings and account">${S.account ? esc(initial()) : icon('user')}</button></div>
    </header>
    ${S.searching ? `<div class="search">${icon('search')}<input data-field="query" placeholder="Search your days" value="${esc(S.query)}" aria-label="Search your days"><button data-act="search" aria-label="Close search">${icon('close')}</button></div>` : ''}
    ${carousel}</div>
    <div class="home-list">
    <div class="chips" role="group" aria-label="Filter">${filters.map(([k, n]) => `<button class="chip" data-act="filter" data-arg="${k}" aria-pressed="${S.filter === k}">${n}</button>`).join('')}</div>
    ${sections.length ? sections.map(([name, rs], i) => `<div class="sec-head"><h2>${name}<span>${rs.length}</span></h2>${i === 0 ? tools : ''}</div>
      <div class="${S.layout}">${rs.map(r => card(r.e, ctx, openAttrs(r.e))).join('')}</div>`).join('')
      : `<div class="sec-head"><span></span>${tools}</div><div class="empty"><div class="big">🌤️</div><b>${q ? 'No matches' : 'Nothing here yet'}</b>${q ? 'Try another word.' : 'Add a day and give it a photo or a color.'}</div>`}
    ${nArch && S.filter === 'all' && !q ? `<button class="arch-row" data-act="go" data-arg="archive">${icon('archive')}<span>Archived</span><span class="cv">${nArch}${icon('chev')}</span></button>` : ''}
    <div style="height:130px"></div>
  </div></section>
  <div class="bottom-fade"></div>
  <button class="fab" data-act="new">${icon('plus')}New day</button>`;
}

function archiveView() {
  const list = visible().filter(e => e.archived);
  return `<section class="view" data-key="archive">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1 class="page-title">Archived</h1>
    <p class="lead">Hidden from Home, the pinned carousel and widgets. Reminders and notifications are off. Long-press a day to unarchive it.</p>
    ${list.length ? `<div class="list">${list.map(e => card(e, 'row', openAttrs(e))).join('')}</div>`
      : '<div class="empty"><div class="big">🗂️</div><b>Nothing archived</b>Archive a day from its menu to tidy up Home.</div>'}
    <div style="height:40px"></div>
  </section>`;
}

function milestonesBlock(ev, c) {
  if (ev.kind === 'smart') {
    const pct = yearPct(), left = ev.rule === 'holidays' ? holidaysLeft() : [];
    return `<div class="block"><h3>This year<span>${pct}% done</span></h3><div class="progress"><i style="width:${pct}%"></i></div>
      <p class="note">${left.length ? `Next: ${left.map(d => fmtDate(d)).join(' · ')}` : `${fmt(smartCount('year'))} days left, ${fmt(smartCount('weekends'))} weekends.`}</p></div>`;
  }
  if (!c.past) {
    const start = parse(ev.created), total = Math.max(1, diffDays(start, c.target)), done = Math.min(total, Math.max(0, diffDays(start, today())));
    const pct = Math.round(done / total * 100);
    const extra = ev.repeat === 'yearly' && parse(ev.date) < today()
      ? `<p class="note">First one was ${fmtDate(parse(ev.date), 'year')}, <b>${fmt(diffDays(parse(ev.date), today()))} days</b> ago.</p>` : '';
    return `<div class="block"><h3>Countdown<span>${pct}% of the wait done</span></h3><div class="progress"><i style="width:${pct}%"></i></div>
      <p class="note">Added ${fmtDate(start, 'year')} · ${fmt(total - done)} days to go${ev.reminder !== 'none' ? ` · reminder ${REMINDERS.find(r => r[0] === ev.reminder)[1].toLowerCase()}` : ''}</p>${extra}</div>`;
  }
  const n = c.days + (S.settings.dayOne ? 1 : 0);
  const next = MILESTONES.find(m => m > n) || Math.ceil((n + 1) / 1000) * 1000;
  const prev = [...MILESTONES].reverse().find(m => m <= n) || 0;
  const pct = Math.round((n - prev) / (next - prev) * 100);
  const yrs = ymdBetween(c.target, today()).y, nextAnniv = addMonths(c.target, 12 * (yrs + 1));
  const shown = MILESTONES.filter(m => m <= next).slice(-6);
  return `<div class="block"><h3>Milestones<span>${fmt(n)} days so far</span></h3>
    <p class="big-line">Day ${fmt(next)} <small>in ${fmt(next - n)} days · ${fmtDate(addDays(today(), next - n))}</small></p>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="ms-chips">${shown.map(m => `<span class="ms ${m <= n ? 'done' : ''}">${m <= n ? '✓ ' : ''}${fmt(m)}</span>`).join('')}</div>
    <p class="note">${ordinal(yrs + 1)} anniversary on <b>${fmtDate(nextAnniv, 'year')}</b>, in ${fmt(diffDays(today(), nextAnniv))} days.</p></div>`;
}

const avatars = names => `<span class="avs">${names.map((n, i) => `<span class="av ${i % 2 ? 'alt' : ''}" title="${esc(n)}">${esc(n[0])}</span>`).join('')}</span>`;
function sharedBlock(ev) {
  if (ev.owner) {
    const can = ev.role === 'editor' ? 'You can change the date, look and music, and see history. Notes, category, pin and memos stay with the owner.' : 'You see every change live. Only the owner and editors can change it.';
    return `<div class="block"><h3>Shared with you<span>${ev.role === 'editor' ? 'Editor' : 'Viewer'}</span></h3>
      <div class="who">${avatars([ev.owner.name, ...ev.members.filter(m => m.name !== 'You').map(m => m.name)])}<span><b>${esc(ev.owner.name)}</b> owns this day · ${ev.members.length + 1} people</span></div><p class="note">${can}</p></div>`;
  }
  if (!sharedOut(ev)) return '';
  const desc = ev.members.map(m => `${m.name} can ${m.role === 'editor' ? 'edit' : 'view'}`).join(', ');
  return `<div class="block"><h3>Shared<span>${ev.members.length} ${ev.members.length === 1 ? 'person' : 'people'} · ${ev.links.length} public ${ev.links.length === 1 ? 'link' : 'links'}</span></h3>
    <div class="who">${avatars(ev.members.map(m => m.name))}<span>${esc(desc)}</span></div>
    <button class="btn btn-ghost sm" data-act="share-tab" data-arg="people">Manage people and links</button></div>`;
}

function detailView() {
  const ev = byId(S.detailId);
  if (!ev || !visible().includes(ev)) { S.screen = 'home'; return homeView(); }
  const c = calc(ev), v = valueFor(ev, ev.unit, c), r = role(ev), own = r === 'owner';
  const [, catName, catEmoji] = catOf(ev);
  const rep = ev.repeat === 'none' ? '' : ` · ${ev.repeat === 'custom' ? `Every ${ev.every} days` : REPEATS.find(x => x[0] === ev.repeat)[1]}`;
  const style = ev.look.style === 'outline' ? 'clean' : ev.look.style;
  const a = ev.audio, playable = !!a, smart = ev.kind === 'smart';
  const shareAct = smart ? 'data-act="toast" data-arg="Smart days can’t be shared yet."' : 'data-act="share"';
  // Spotify: a short preview plays in the app (assumption to check when building); the full song opens in Spotify.
  const music = !a ? '' : a.type === 'spotify'
    ? `<button class="gbtn spot" data-act="audio" aria-label="${S.playing ? 'Stop' : 'Play'} preview of ${esc(a.title)}" aria-pressed="${S.playing}">${S.playing ? '<span class="eq"><i></i><i></i><i></i></span>' : icon('spotify')}</button>`
    : `<button class="gbtn" data-act="audio" aria-label="${S.playing ? 'Pause' : 'Play'} ${esc(audioName(a))}" aria-pressed="${S.playing}"><span class="disc ${S.playing ? 'playing' : ''}"></span></button>`;
  const acts = [
    r !== 'viewer' && `<button class="act" data-act="edit" data-arg="${ev.id}">${icon('edit')}${own ? 'Customize' : 'Edit'}</button>`,
    own && !smart && `<button class="act" data-act="share">${icon('share')}Share</button>`,
    !own && r === 'editor' && `<button class="act" data-act="history">${icon('history')}History</button>`,
    (a || r !== 'viewer') && `<button class="act" data-act="${!a ? 'edit-sound' : 'audio'}" aria-pressed="${S.playing && playable}">${S.playing && playable ? '<span class="eq"><i></i><i></i><i></i></span>' : icon(a?.type === 'spotify' ? 'spotify' : 'music')}${!a ? 'Add music' : a.type === 'spotify' ? 'Preview' : 'Music'}</button>`,
    own && `<button class="act" data-act="focus-memo">${icon('memo')}Memo</button>`,
    !own && r === 'viewer' && `<button class="act" data-act="report">${icon('flag')}Report</button>`,
    !own && `<button class="act" data-act="leave" data-arg="${ev.id}">${icon('leave')}Leave</button>`,
  ].filter(Boolean);
  const memos = ev.memos.map(m => `<div class="memo"><span class="av">${esc(initial())}</span><div>
      <div class="memo-meta"><b>You</b><span>${fmtDate(parse(m.date), 'year')}</span>${m.tag ? `<span class="tag">${esc(m.tag)}</span>` : ''}</div><p>${esc(m.text)}</p></div></div>`).join('');
  const zoneText = ev.zone ? (ev.zone === DEVICE_TZ ? `Fixed · ${city(ev.zone)} (this device)` : `Fixed · ${city(ev.zone)}`) : 'Floating · each viewer’s local time';
  return `<section class="view detail" data-key="detail">
    <article class="${cardClass(ev, 'detail', style)}" style="${cardVars(ev.look)}" data-act="motion">${layers(ev.look, S.motion)}<div class="card-body">
      <header class="d-bar"><button class="gbtn" data-act="back" aria-label="Back">${icon('back')}</button><span class="sp"></span>
        ${music}<button class="gbtn" ${shareAct} aria-label="Share">${icon('share')}</button>
        <button class="gbtn" data-act="more" data-arg="${ev.id}" aria-label="More actions">${icon('more')}</button></header>
      <div class="d-main">
        <div class="kick"><span class="glass-pill">${ev.owner ? `${icon('people', 'mini')}${esc(ev.owner.name)} · ${ev.role === 'editor' ? 'Editor' : 'Viewer'}` : `${catEmoji} ${catName}`}${rep}</span>${ev.look.bg.animated ? '<span class="glass-pill live"><i></i>Live</span>' : ''}${ev.archived ? '<span class="glass-pill">Archived</span>' : ''}</div>
        <span class="emo">${ev.emoji}</span>
        <h1 class="t">${title(ev)}</h1>
        <div class="m">${esc(metaLong(ev, c))}${occurrence(ev, c) && !c.today ? ` · ${esc(occurrence(ev, c))}` : ''}</div>
        <button class="d-count" data-act="${smart ? 'none' : 'cycle-unit'}" aria-label="Switch unit">${count(v)}<span class="u">${v.u}</span></button>
        <div class="tick" data-tick="${ev.id}">${tickText(ev)}</div>
        ${r === 'viewer' || smart ? '' : `<div class="seg seg-glass units" role="group" aria-label="Unit">${UNITS.map(([k, n]) => `<button data-act="unit" data-arg="${k}" aria-pressed="${ev.unit === k}">${n}</button>`).join('')}</div>`}
      </div></div></article>
    <div class="d-panel"><div class="grabber"></div>
      <div class="actions c${acts.length}">${acts.join('')}</div>
      ${sharedBlock(ev)}
      ${milestonesBlock(ev, c)}
      ${own ? `<div class="block" id="memos"><h3>Memos<span>${ev.memos.length ? `${ev.memos.length} · only you` : 'only you'}</span></h3>${memos}
        <div class="compose"><input data-field="memo" placeholder="Write a memory or a note" aria-label="New memo"><button class="send" data-act="add-memo" aria-label="Add memo">${icon('send')}</button></div></div>` : ''}
      <div class="block"><h3>Details</h3>
        ${smart ? `<div class="kv"><span>Counts</span><span>${SMART[ev.rule].label}</span></div><div class="kv"><span>Updates</span><span>Every day at midnight</span></div>`
        : `<div class="kv"><span>Date</span><span>${fmtDate(parse(ev.date), 'long')}</span></div>
        <div class="kv"><span>Time</span><span>${ev.time ? fmtTime(ev.time) : 'All day'}</span></div>
        <div class="kv"><span>Time zone</span><span>${zoneText}</span></div>
        <div class="kv"><span>Repeats</span><span>${ev.repeat === 'custom' ? `Every ${ev.every} days` : REPEATS.find(x => x[0] === ev.repeat)[1]}</span></div>`}
        ${a ? `<div class="kv"><span>Music</span><span>${esc(audioName(a))}${a.type === 'track' ? ` · ${esc(track(a.id).artist)}` : a.type === 'file' ? ' · My library' : ` · <button class="link-btn" data-act="spotify">Open in Spotify</button>`}</span></div>` : ''}
        ${ev.archived ? `<div class="kv"><span>Archived</span><span>Yes · <button class="link-btn" data-act="archive" data-arg="${ev.id}">Unarchive</button></span></div>` : ''}
        ${own ? `<div class="kv"><span>Reminder</span><span>${REMINDERS.find(x => x[0] === ev.reminder)[1]}</span></div>
        <div class="kv"><span>Pinned</span><span>${ev.pinned ? 'Yes, in the carousel' : 'No'}</span></div>
        ${ev.notes ? `<div class="kv"><span>Notes</span><span>${esc(ev.notes)}</span></div>` : ''}` : ''}
        ${own && S.account ? `<button class="btn btn-ghost sm" data-act="history" style="margin-top:12px">${icon('history')}History</button>` : ''}</div>
    </div>
  </section>`;
}

function editorView() {
  const d = S.draft, isNew = !byId(d.id);
  const tabs = [['details', 'Details'], ['background', 'Background'], ['style', 'Style'], ['sound', 'Sound']];
  return `<section class="view editor" data-key="editor">
    <div class="ed-top">
      <div class="ed-bar"><button class="txt-btn" data-act="cancel">Cancel</button><span class="ttl">${isNew ? 'New day' : d.owner ? `Edit · ${esc(d.owner.name)}’s day` : 'Customize'}</span><button class="save-btn" data-act="save">Save</button></div>
      <div class="ed-preview" id="preview">${previewHTML()}</div>
      <div class="prev-switch"><div class="seg sm" role="group" aria-label="Preview as">${[['hero', d.owner ? 'Large' : 'Pinned'], ['row', 'List'], ['ws', 'Widget']].map(([k, n]) => `<button data-act="prev-ctx" data-arg="${k}" aria-pressed="${S.prevCtx === k}">${n}</button>`).join('')}</div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-act="ed-tab" data-arg="${k}" aria-selected="${S.edTab === k}">${n}</button>`).join('')}</div>
    </div>
    <div class="ed-body">${EDITOR_TABS[S.edTab](d)}</div>
  </section>`;
}
const previewHTML = () => card(S.draft, S.prevCtx, '', S.motion);
const pressed = (a, b) => `aria-pressed="${a === b}"`;
const chips = (items, act, cur) => `<div class="chips-wrap">${items.map(([k, n]) => `<button class="chip" data-act="${act}" data-arg="${k}" ${pressed(cur, k)}>${n}</button>`).join('')}</div>`;

const EDITOR_TABS = {
  details: d => {
    const own = isOwner(d), n = pins().filter(e => e.id !== d.id).length;
    const zones = [[DEVICE_TZ, `${city(DEVICE_TZ)} (this device)`], ...(d.zone && d.zone !== DEVICE_TZ ? [[d.zone, city(d.zone)]] : []), ['floating', 'Floating']];
    const when = d.kind === 'smart'
      ? `<div class="info">${icon('sparkle')}<span><b>Smart day:</b> ${SMART[d.rule].label.toLowerCase()}. The number updates every day.${d.rule === 'holidays' ? ` Holidays: ${HOLIDAYS.region}.` : ''} Smart days can't be shared yet.</span></div>`
      : `<div class="row2"><div><div class="flabel">Date</div><input class="input" type="date" data-field="date" value="${d.date}"></div>
      <div><div class="flabel"><span>Time</span><span class="opt">optional</span></div><input class="input" type="time" data-field="time" value="${d.time || ''}"></div></div>
    <div><div class="flabel"><span>Time zone</span></div>${chips(zones, 'zone', d.zone || 'floating')}
      <p class="note">${d.zone ? '<b>Fixed:</b> everyone counts to the same moment. Good for flights and launches.' : '<b>Floating:</b> everyone counts to their own local time. Good for birthdays and New Year.'}</p></div>
    <div><div class="flabel">Repeat</div>${chips(REPEATS, 'repeat', d.repeat)}
      ${d.repeat === 'custom' ? `<label class="inline-num">Every <input class="input" type="number" min="2" max="365" data-field="every" value="${d.every}"> days</label>` : ''}</div>`;
    return `<div><div class="flabel"><span>Title</span><span class="opt" id="title-count">${d.title.length}/100</span></div><input class="input title" data-field="title" maxlength="100" value="${esc(d.title)}" placeholder="What are you counting?"></div>
    <div><div class="flabel">Emoji</div><div class="emojis">${EMOJIS.map(e => `<button class="emoji-opt" data-act="emoji" data-arg="${e}" ${pressed(d.emoji, e)} aria-label="Emoji ${e}">${e}</button>`).join('')}</div></div>
    ${when}
    ${own ? `<div><div class="flabel">Category <span class="opt">only you</span></div>${chips(CATS.map(([k, n, e]) => [k, `${e} ${n}`]), 'cat', d.category)}</div>
    <div class="switch-row"><div><b>Pin to top</b><small>${d.pinned ? 'In the carousel at the top of Home, and still in the list' : n ? `Joins ${n} pinned ${n === 1 ? 'day' : 'days'} in the carousel` : 'Shows in a carousel at the top of Home'}</small></div>
      <button class="switch" role="switch" aria-label="Pin to top" aria-checked="${d.pinned}" data-act="draft-pin"></button></div>
    <div><div class="flabel"><span>Notes</span><span class="opt">only you · <span id="notes-count">${d.notes.length}</span>/4,000</span></div><textarea class="input area" data-field="notes" maxlength="4000" rows="3" placeholder="Anything to remember. Never shared.">${esc(d.notes)}</textarea></div>`
      : `<div class="info">${icon('info')}<span>${esc(d.owner.name)} keeps the notes, category, pin and memos. Your changes show up for everyone with access and in history.</span></div>`}
    <div><div class="flabel"><span>Remind me<span class="new">New</span></span></div>${chips(REMINDERS, 'reminder', d.reminder)}</div>`;
  },
  background: d => {
    const L = d.look, bg = L.bg, ci = contrastInfo(L), lim = LIMITS[S.plan], u = usage(d.id);
    const used = u.photos + (bg.type === 'photo' ? 1 : 0);
    const pane = {
      color: () => `<div class="swatches">${COLORS.map(([n, h]) => `<button class="sw" style="background:${h}" data-act="color" data-arg="${h}" aria-label="${n}" ${pressed(bg.type === 'color' && bg.value.toUpperCase(), h)}></button>`).join('')}
        <label class="sw sw-custom" aria-label="Custom color" title="Custom color"><input type="color" data-field="color" value="${bg.type === 'color' ? bg.value : '#CDEFDF'}"></label></div>`,
      gradient: () => `<div class="tiles">${Object.entries(GRADS).map(([k, g]) => `<button class="tile-opt" style="${esc(`background:${g.css}`)}" data-act="grad" data-arg="${k}" ${pressed(bg.id, k)}><span class="lbl" style="color:${lum(g.base) > .2 ? '#111714' : '#fff'}">${g.name}</span></button>`).join('')}</div>`,
      photo: () => `<div class="usage"><span>${S.plan === 'free' ? 'Free' : 'Premium'} · ${used} of ${lim.photos} photo backdrops</span><span>Live photos: ${S.plan === 'free' ? proBadge() : `${u.animated + (bg.animated ? 1 : 0)} of ${lim.animated}`}</span></div>
        <div class="tiles"><label class="tile-opt upload">${icon('upload')}Photos<input type="file" accept="image/*" data-field="photo" hidden></label>
        ${PHOTOS.map(([id, live]) => `<button class="tile-opt" style="background-image:url('${thumb(id)}')" data-act="photo" data-arg="${id}" aria-label="Sample ${live ? 'Live ' : ''}photo ${id}" ${pressed(bg.src, pic(id))}>${live ? '<span class="live-tag"><i></i>LIVE</span>' : ''}</button>`).join('')}</div>
        ${bg.type === 'photo' ? `${bg.canAnimate ? `<div class="switch-row"><div><b>Play as Live Photo ${S.plan === 'free' ? proBadge() : ''}</b><small>Plays once when the day opens, then rests on the key photo. Lists and widgets show the still.</small></div><button class="switch" role="switch" aria-label="Animated" aria-checked="${!!bg.animated}" data-act="toggle-live"></button></div>` : ''}
          <div><div class="flabel"><span>Focus point</span><span class="opt">tap the photo</span></div><div class="focal" data-act="focal" style="background-image:url('${esc(bg.src)}')"><i style="left:${bg.fx ?? 50}%;top:${bg.fy ?? 50}%"></i></div></div>
          <p class="note">Sized on your phone (at most 1.5 MB; Live Photos 5 s, silent). Location and camera data are removed. People you share with see it, animated or not, whatever their plan.</p>` : ''}`,
      art: () => `<div class="tiles">${Object.entries(ART).map(([k, a]) => `<button class="tile-opt" style="${esc(`background:${svgURL(a.svg)} center/cover`)}" data-act="art" data-arg="${k}" ${pressed(bg.type === 'art' && bg.id, k)}><span class="lbl" style="color:${lum(a.base) > .2 ? '#111714' : '#fff'}">${a.name}</span></button>`).join('')}</div>`,
    };
    return `<div class="seg" role="group" aria-label="Background type">${[['photo', 'Photo'], ['color', 'Color'], ['gradient', 'Gradient'], ['art', 'Art']].map(([k, n]) => `<button data-act="bg-tab" data-arg="${k}" ${pressed(S.bgTab, k)}>${n}</button>`).join('')}</div>
      ${pane[S.bgTab]()}
      <div>
        <label class="slider-row">Darken<input type="range" min="0" max="80" value="${Math.round(L.dim * 100)}" data-field="dim"><output id="dim-out">${Math.round(L.dim * 100)}%</output></label>
        ${bg.type === 'photo' || bg.type === 'art' ? `<label class="slider-row">Blur<input type="range" min="0" max="16" value="${L.blur || 0}" data-field="blur"><output id="blur-out">${L.blur || 0}</output></label>` : ''}
        <div class="contrast ${ci.ok ? '' : 'warn'}" id="contrast"><i></i>${esc(ci.text)}</div>
      </div>`;
  },
  style: d => {
    const L = d.look, n = strip(valueFor(d, 'days', calc(d)).num).slice(0, 4);
    return `<div><div class="flabel">Card style</div><div class="style-opts">${Object.entries(STYLES).map(([k, [name, sub]]) =>
      `<div class="style-opt" role="button" tabindex="0" data-act="style" data-arg="${k}" ${pressed(L.style, k)}>${card({ ...d, look: { ...L, style: k } }, 'mini')}<div class="lbl">${name}<small>${sub}</small></div></div>`).join('')}</div></div>
    <div><div class="flabel"><span>Size in the list</span><span class="opt">Home list and grid</span></div><div class="seg">${SIZES.map(([k, n]) => `<button data-act="size" data-arg="${k}" ${pressed(L.size || 'md', k)}>${n}</button>`).join('')}</div>
      <p class="note">Small fits more days on a screen. Large adds the live countdown and takes the full width in the grid.</p></div>
    <div><div class="flabel">Typeface</div><div class="font-opts">${Object.entries(FONTS).map(([k, name]) => `<button class="font-opt font-${k}" data-act="font" data-arg="${k}" ${pressed(L.font, k)}><b>${n}</b><span>${name}</span></button>`).join('')}</div></div>
    <div><div class="flabel">Text color</div><div class="seg">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-act="text" data-arg="${k}" ${pressed(L.text, k)}>${n}</button>`).join('')}</div>
      <div class="contrast ${contrastInfo(L).ok ? '' : 'warn'}"><i></i>${esc(contrastInfo(L).text)}</div></div>
    ${d.kind === 'smart' ? '' : `<div><div class="flabel">Count in</div>${chips(UNITS, 'draft-unit', d.unit)}<p class="note"><b>Auto</b> shows days, then hours and minutes in the last 48 hours. <b>Workdays</b> counts Monday to Friday and skips weekends; public holidays are not skipped yet. Everyone with access sees this unit.</p></div>`}`;
  },
  sound: d => {
    const a = d.audio, t = S.soundTab, u = usage(d.id);
    const none = `<div class="track" role="radio" tabindex="0" aria-checked="${!a}" data-act="track" data-arg=""><span class="play">${icon('close')}</span><div class="cl"><b>No music</b><small>Quiet day page</small></div><span class="radio"></span></div>`;
    const panes = {
      builtin: () => `<div class="tracks">${none}${TRACKS.map(tr => `<div class="track" role="radio" tabindex="0" aria-checked="${a?.type === 'track' && a.id === tr.id}" data-act="track" data-arg="${tr.id}">
          <button class="play" data-act="preview-track" data-arg="${tr.id}" aria-label="Preview ${esc(tr.title)}">${S.trackPreview === tr.id ? '<span class="eq"><i></i><i></i><i></i></span>' : icon('play')}</button>
          <div class="cl"><b>${esc(tr.title)}${tr.premium ? proBadge() : ''}</b><small>${esc(tr.artist)} · ${tr.dur}</small></div><span class="radio"></span></div>`).join('')}</div>
        <p class="note">${TRACKS.filter(x => !x.premium).length} tracks are free; Premium unlocks all ${TRACKS.length}. Anyone who can see this day can play its track. Public domain recordings.</p>`,
      library: () => {
        const items = S.library.filter(l => !l.removed).sort((x, y) => y.created - x.created), eq = '<span class="eq"><i></i><i></i><i></i></span>';
        const pending = a?.isNew ? `<div class="track" aria-checked="true"><button class="play" data-act="preview-track" data-arg="${a.id}" aria-label="Preview">${S.trackPreview === a.id ? eq : icon('play')}</button>
          <div class="cl"><b>${esc(a.title)}<span class="new">New</span></b><small>Keeping ${a.keep} of ${a.dur} · AAC, under 4 MB</small></div><button class="mini-btn" data-act="track" data-arg="" aria-label="Discard">${icon('close')}</button></div>
          <div class="trim" aria-label="Section to keep"><i style="left:11%;right:13%"></i></div>` : '';
        return `<button class="switch-row" data-act="pick-file"><div><b>${icon('upload', 'mini')}Pick an audio file ${S.plan === 'free' ? proBadge() : ''}</b><small>MP3, M4A, WAV and more. Converted on your phone.</small></div>${icon('chev')}</button>
        ${pending}
        <p class="group-label flush">Your library · ${items.length}</p>
        ${items.length ? `<div class="tracks">${items.map(l => { const n = libUsedBy(l.id); return `<div class="track" role="radio" tabindex="0" aria-checked="${a?.type === 'file' && a.id === l.id}" data-act="lib-use" data-arg="${l.id}">
          <button class="play" data-act="preview-track" data-arg="${l.id}" aria-label="Preview ${esc(l.title)}">${S.trackPreview === l.id ? eq : icon('play')}</button>
          <div class="cl"><b>${esc(l.title)}</b><small>${l.dur} · ${n ? `used on ${n} ${n === 1 ? 'day' : 'days'}` : 'not used yet'}</small></div>
          <button class="mini-btn" data-act="lib-remove" data-arg="${l.id}" aria-label="Remove ${esc(l.title)} from your library">${icon('close')}</button></div>`; }).join('')}</div>`
          : '<p class="note">Songs you add show up here, so you can use them on other days.</p>'}
        <p class="note">At most 4 MB each (about 5½ minutes); for a longer song you pick the part to keep. Plays for you and the people you invite, never on public links. × removes a song from this list only: days that use it keep playing it, and it counts toward your ${LIMITS.premium.files} songs until no day uses it.${S.plan === 'premium' ? ` ${u.files} of ${LIMITS.premium.files} in use.` : ' Preview is free; saving a song on a day needs Premium.'}</p>`;
      },
      spotify: () => `${a?.type === 'spotify' ? `<div class="track" aria-checked="true"><button class="play spot" data-act="preview-track" data-arg="spotify" aria-label="Play preview">${S.trackPreview === 'spotify' ? '<span class="eq"><i></i><i></i><i></i></span>' : icon('spotify')}</button><div class="cl"><b>${esc(a.title)}</b><small>${esc(a.kind)} · 30-second preview here, full song in Spotify</small></div><button class="txt-btn" data-act="track" data-arg="">Remove</button></div>`
          : `<div class="paste"><input class="input" data-field="spotify" placeholder="Paste a Spotify link" aria-label="Spotify link"><button class="save-btn" data-act="add-spotify">Add</button></div>`}
        <p class="note">Share a song, album or playlist from Spotify to Days That Matter, or paste its link. No Spotify sign-in. A short preview plays here (to be checked against Spotify's current rules when building); the full song opens in Spotify.${S.plan === 'free' ? ` Free: Spotify on 3 days (${u.spotify} used).` : ''} Not offered in regions without Spotify.</p>`,
    };
    return `<div class="seg" role="group" aria-label="Music source">${[['builtin', 'Built-in'], ['library', 'My library'], ['spotify', 'Spotify']].map(([k, n]) => `<button data-act="sound-tab" data-arg="${k}" ${pressed(t, k)}>${n}</button>`).join('')}</div>
      ${panes[t]()}
      ${a && a.type !== 'spotify' ? `<p class="group-label flush">On this device</p>
      <div><label class="slider-row">Volume<input type="range" min="0" max="100" value="70"><output>70%</output></label></div>
      <div class="switch-row"><div><b>Loop</b><small>Play again from the start</small></div><button class="switch" role="switch" aria-checked="true" aria-label="Loop" data-act="flip"></button></div>
      <div class="switch-row"><div><b>Fade in and out</b><small>1.5 s, no abrupt cuts</small></div><button class="switch" role="switch" aria-checked="true" aria-label="Fade" data-act="flip"></button></div>` : ''}`;
  },
};

function settingsView() {
  const st = S.settings, a = S.account, L = LIMITS[S.plan], u = usage(), premium = S.plan === 'premium', lc = localCount();
  const locked = (ic, label, why) => `<button class="cell locked" data-act="signin-prompt" data-arg="${why}"><span class="ci">${icon(ic)}</span><span class="cl">${label}<small>Needs an account</small></span><span class="cv">${icon('lock')}</span></button>`;
  const sw = (k, label) => `<button class="switch" role="switch" aria-label="${label}" aria-checked="${st[k]}" data-act="set-flag" data-arg="${k}"></button>`;
  const meter = (label, n, max) => `<div class="cell"><span class="cl">${label}<span class="meter"><i style="width:${Math.min(100, n / max * 100)}%"></i></span></span><span class="cv">${n} of ${max}</span></div>`;
  const gated = (label, n, max) => premium ? meter(label, n, max) : `<div class="cell"><span class="cl">${label}</span><span class="cv">${proBadge()}</span></div>`;
  const link = (ic, label, msg, val = '') => `<button class="cell" data-act="toast" data-arg="${esc(msg)}"><span class="ci">${icon(ic)}</span><span class="cl">${label}</span><span class="cv">${val}${icon('chev')}</span></button>`;
  return `<section class="view" data-key="settings">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1 class="page-title">Settings</h1>
    ${a ? `<div class="profile"><span class="pic">${esc(initial())}</span><div><button class="profile-name" data-act="edit-name"><b class="${(a.name || '').trim() ? '' : 'muted'}">${esc((a.name || '').trim() || 'Add your name')}</b>${icon('edit')}</button><small>${esc(a.email)} · ${a.methods.map(methodName).join(', ')}</small></div><span class="pro ${premium ? '' : 'free'}">${premium ? 'Premium' : 'Free'}</span></div>
      <div class="group">
        <div class="cell"><span class="ci">${icon('cloud')}</span><span class="cl">Sync<small>${S.pending ? `${S.pending} ${S.pending === 1 ? 'change' : 'changes'} waiting` : `Synced ${ago(S.lastSync)}`}</small></span><button class="btn btn-ghost sm" data-act="sync">Sync now</button></div>
      </div>
      <p class="group-label">Your events on this device<span class="new">New</span></p>
      <div class="group">
        ${lc.days ? `<button class="cell" data-act="import-open"><span class="ci">${icon('upload')}</span><span class="cl">Import days from this device<small>${plural(lc.days, 'day')} and ${plural(lc.memos, 'memo')} kept on this phone, not in your account</small></span><span class="cv">${lc.days}${icon('chev')}</span></button>` : ''}
        <button class="cell" data-act="export-events"><span class="ci">${icon('download')}</span><span class="cl">Export events<small>Save to a backup file</small></span><span class="cv">${icon('chev')}</span></button>
        <button class="cell" data-act="file-import-open"><span class="ci">${icon('upload')}</span><span class="cl">Import events<small>Restore from a backup file</small></span><span class="cv">${icon('chev')}</span></button>
      </div>`
    : `<div class="profile"><span class="pic">🌤️</span><div><button class="profile-name" data-act="edit-name"><b class="${(S.localName || '').trim() ? '' : 'muted'}">${esc((S.localName || '').trim() || 'Add your name')}</b>${icon('edit')}</button><small>Local</small></div><span class="pro free">${premium ? 'Premium' : 'Free'}</span></div>
      <div class="info inset">${icon('info')}<span><b>Local mode.</b> Everything about your own days works here, offline. Sharing, sync, history and invites need an account. Premium features and the plan's limits still apply, so signing in later never goes over them.</span></div>
      <div class="cta-wrap"><button class="btn btn-accent" data-act="signin-prompt" data-arg="settings">Sign in or create an account</button></div>
      <p class="group-label">Your events on this device<span class="new">New</span></p>
      <div class="group">
        <button class="cell" data-act="export-events"><span class="ci">${icon('download')}</span><span class="cl">Export events<small>Save to a backup file</small></span><span class="cv">${icon('chev')}</span></button>
        <button class="cell" data-act="file-import-open"><span class="ci">${icon('upload')}</span><span class="cl">Import events<small>Restore from a backup file</small></span><span class="cv">${icon('chev')}</span></button>
      </div>
      <p class="group-label">Needs an account</p>
      <div class="group">
        ${locked('cloud', 'Sync across devices', 'sync')}${locked('share', 'Sharing and invites', 'share')}${locked('history', 'History and restore', 'history')}${locked('download', 'Backup and download my data', 'backup')}
      </div>`}
    <p class="group-label">Plan</p>
    <div class="group">
      ${meter('Events', u.events, L.events)}
      ${meter('Photo backdrops', u.photos, L.photos)}
      ${gated('Live photos', u.animated, L.animated)}
      ${gated('Your music files', u.files, L.files)}
      ${L.spotify !== undefined ? (premium ? `<div class="cell"><span class="cl">Spotify events</span><span class="cv">${u.spotify} · no limit</span></div>` : meter('Spotify events', u.spotify, L.spotify)) : ''}
      <div class="cell">${premium ? '<span class="cl">Manage in the App Store</span>' : '<button class="btn btn-primary sm" data-act="paywall">Upgrade to Premium</button>'}<button class="txt-btn" data-act="restore">Restore purchases</button></div>
    </div>
    ${a ? '' : '<p class="note pad">Local mode follows the same limits as an account, so signing in later never puts you over them. Premium features stay Premium.</p>'}
    <p class="group-label">Appearance</p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('sun')}</span><span class="cl">Theme</span><div class="seg sm">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-act="theme" data-arg="${k}" ${pressed(st.theme, k)}>${n}</button>`).join('')}</div></div>
      <div class="cell"><span class="ci">${icon('palette')}</span><span class="cl">Accent</span><div class="accents">${ACCENTS.map(([k, h]) => `<button style="background:${h}" data-act="accent" data-arg="${k}" aria-label="Accent ${k}" ${pressed(st.accent, k)}></button>`).join('')}</div></div>
      <div class="cell"><span class="ci">${icon('pin')}</span><span class="cl">Pinned carousel<small>Pinned days at the top of Home</small></span>${sw('showHero', 'Pinned carousel')}</div>
      <div class="cell"><span class="ci">${icon('sun')}</span><span class="cl">Greeting on Home<span class="new">New</span><small>“Good morning, ${esc((a ? a.name : S.localName).trim() || '…')}” instead of “Your days”</small></span>${sw('greeting', 'Greeting on Home')}</div>
      <div class="cell"><span class="ci">${icon('grid')}</span><span class="cl">Home layout</span><div class="seg sm">${[['list', 'List'], ['grid', 'Grid']].map(([k, n]) => `<button data-act="layout-set" data-arg="${k}" ${pressed(S.layout, k)}>${n}</button>`).join('')}</div></div>
    </div>
    <p class="group-label">Counting</p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('sparkle')}</span><span class="cl">Count the first day as Day 1<span class="new">New</span><small>“Day 1,972” instead of “1,971 days since”</small></span>${sw('dayOne', 'Count the first day as Day 1')}</div>
      <div class="cell"><span class="ci">${icon('calendar')}</span><span class="cl">Week starts on</span><div class="seg sm">${[['mon', 'Mon'], ['sun', 'Sun']].map(([k, n]) => `<button data-act="week" data-arg="${k}" ${pressed(st.weekStart, k)}>${n}</button>`).join('')}</div></div>
    </div>
    <p class="group-label">Notifications<span class="new">New</span></p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('bell')}</span><span class="cl">Reminders<small>Before and on the day, set per day. Work offline.</small></span>${sw('notify', 'Reminders')}</div>
      ${link('sun', 'Deliver reminders at', 'Time picker', '9:00 AM')}
      <div class="cell"><span class="ci">${icon('people')}</span><span class="cl">Changes to shared days<small>When someone else edits a day you share</small></span>${sw('notifyShared', 'Changes to shared days')}</div>
      <div class="cell"><span class="ci">${icon('plus')}</span><span class="cl">Added to a day<small>When someone adds you to a day</small></span>${sw('notifyAdded', 'Added to a day')}</div>
      <div class="cell"><span class="ci">${icon('sparkle')}</span><span class="cl">Offers and news<small>Like free Premium weeks. Off unless you turn it on; at most 2 a month.</small></span>${sw('notifyOffers', 'Offers and news')}</div>
    </div>
    <p class="group-label">More</p>
    <div class="group">
      <button class="cell" data-act="go" data-arg="widgets"><span class="ci">${icon('widgets')}</span><span class="cl">Widgets</span><span class="cv">${icon('chev')}</span></button>
      ${link('trash', 'Recently deleted<span class="new">New</span>', 'Deleted days stay here for 30 days.')}
      ${link('lock', 'Privacy lock<span class="new">New</span>', 'Face ID / fingerprint lock, and hiding private days from widgets.', 'Off')}
      ${link('globe', 'Language', 'English, 简体中文, 繁體中文 …', 'English')}
      ${link('info', 'Terms of Service', 'Opens daysthatmatter.app/terms')}
      ${link('info', 'Privacy Policy', 'Opens daysthatmatter.app/privacy')}
    </div>
    ${a ? `<p class="group-label">Account</p>
    <div class="group">
      ${link('edit', 'Display name<small>Members see it in the member list and history</small>', 'Edit display name', esc(a.name))}
      ${link('plus', 'Add sign-in method', 'Apple, Google or email code. Same verified email joins the same account.')}
      ${link('download', 'Download my data', 'We’ll email you a link to download your days, memos and files. It works for 30 days.')}
      <button class="cell" data-act="sign-out"><span class="ci">${icon('leave')}</span><span class="cl">Sign out<small>Back to local mode on this device</small></span></button>
      <button class="cell danger" data-act="delete-account"><span class="ci">${icon('trash')}</span><span class="cl">Delete account</span></button>
    </div>
    <p class="note pad">Accounts not used for 24 months are deleted after two emails sent 3 months apart, each with a link to download your data.</p>` : ''}
    <p class="foot">Days That Matter · design v2 prototype</p>
  </section>`;
}

function widgetLook(ev) {
  if (S.settings.widgetStyle === 'match') return ev;
  const value = S.settings.widgetStyle === 'minimal' ? (isDark() ? '#1E2522' : '#FFFFFF') : '#1F3D33';
  return { ...ev, look: { ...ev.look, bg: { type: 'color', value }, style: 'clean', dim: 0, text: 'auto' } };
}

function widgetPlaceholder(size = 'ws') {
  if (size === 'wm') {
    return `<article class="card ctx-wm w-placeholder">
      <div class="card-body">
        <div class="lead">
          <div class="w-ph-box">
            <span class="emo">⏳</span>
            <div class="w-ph-title">This event isn’t available</div>
            <div class="w-ph-sub">Open the app</div>
          </div>
        </div>
      </div>
    </article>`;
  }
  return `<article class="card ctx-ws w-placeholder">
    <div class="card-body">
      <div class="w-ph-box">
        <span class="emo">⏳</span>
        <div class="w-ph-title">This event isn’t available</div>
        <div class="w-ph-sub">Open the app</div>
      </div>
    </div>
  </article>`;
}

function widgetsView() {
  const mode = S.widgetMode || 'normal';
  const pin = pins()[0] || active()[0];
  const next = active().filter(e => e !== pin).map(e => ({ e, c: calc(e) })).filter(r => !r.c.past).sort((a, b) => a.c.days - b.c.days).slice(0, 3);
  const second = next[0] ? next[0].e : pin;
  const w = widgetLook(pin), c = calc(pin), v = valueFor(pin, 'days', c);

  // Widget 1 (Small) and Widget 2 (Medium) represent the account's events.
  // Widget 3 (Second small) represents a local event kept on this device.
  const acctUnavailable = mode === 'signed-out';
  const localUnavailable = mode === 'not-imported';

  const w1Html = acctUnavailable ? widgetPlaceholder('ws') : card(w, 'ws');
  const w2Html = acctUnavailable ? widgetPlaceholder('wm') : `<article class="${cardClass(w, 'wm')}" style="${cardVars(w.look)}">${layers(w.look)}<div class="card-body">
      <div class="lead"><span class="emo">${pin.emoji}</span><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(pin)}</div></div></div>
      <div class="next">${next.map(r => `<div><span>${r.e.emoji} ${esc(r.e.title)}</span><b>${r.c.today ? 'Today' : fmt(r.c.days) + 'd'}</b></div>`).join('')}</div></div></article>`;
  const w3Html = localUnavailable ? widgetPlaceholder('ws') : card(widgetLook(second), 'ws');

  const start = parse(pin.created), pct = c.past ? 100 : Math.round(Math.min(1, diffDays(start, today()) / Math.max(1, diffDays(start, c.target))) * 100);
  const lockBg = pin.look.bg.type === 'photo' ? bgCSS(pin.look.bg) : GRADS.dusk.css;
  return `<section class="view" data-key="widgets">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1 class="page-title">Widgets</h1>
    <p class="lead">Widgets use each day's own look. Live photos show their key photo. Small shows one day, Medium adds what's next.</p>
    <div class="homescreen" style="${esc(`background:${GRADS.glacier.css}`)}">
      <div class="w-s">${w1Html}</div>
      <div class="apps"><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span></div>
      <div class="w-m">${w2Html}</div>
      <div class="w-s">${w3Html}</div>
      <div class="apps"><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span></div>
    </div>
    <p class="note center pad" style="margin-top:14px">When an event isn’t available on this device, widgets show a placeholder until you open the app.</p>
    <p class="group-label" style="margin-top:18px">Widget look</p>
    <div style="margin:0 16px 22px" class="seg">${[['match', 'Match card'], ['minimal', 'Minimal'], ['tinted', 'Tinted']].map(([k, n]) => `<button data-act="wstyle" data-arg="${k}" ${pressed(S.settings.widgetStyle, k)}>${n}</button>`).join('')}</div>
    <p class="group-label">Lock Screen</p>
    <div class="lock" style="${esc(`background:${lockBg}`)}">
      <div class="lock-date">${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <div class="clock">${clock(new Date()).replace(/\s?[AP]M/, '')}</div>
      <div class="acc-row"><div class="acc-c" style="--p:${pct}%"><div><b>${c.today ? '🎉' : fmt(c.days)}</b><small>${c.past ? 'SINCE' : 'DAYS'}</small></div></div>
        <div class="acc-r">${pin.emoji} ${esc(pin.title)}<b>${strip(v.num)} ${strip(v.u)}</b></div></div>
    </div>
    <div style="height:30px"></div>
  </section>`;
}

const signInButtons = () => `<div class="onb-btns">
  <button class="btn btn-primary" data-act="signin" data-arg="apple">Continue with Apple</button>
  <button class="btn btn-ghost" data-act="signin" data-arg="google"><span class="g-mark">G</span>Continue with Google</button>
  <button class="btn btn-ghost" data-act="signin" data-arg="email">${icon('mail')}Continue with email</button></div>`;
const legal = () => '<p class="legal">By continuing you agree to the <a href="#" data-act="toast" data-arg="Opens the Terms of Service">Terms of Service</a> and <a href="#" data-act="toast" data-arg="Opens the Privacy Policy">Privacy Policy</a>.</p>';

function onboardingView() {
  const picks = ['together', 'norway', 'mia'].map(byId).filter(Boolean);
  return `<section class="view onb" data-key="onboarding">
    <div class="collage" aria-hidden="true">${picks.map((e, i) => `<div class="fl fl${i}">${card(e, 'row')}</div>`).join('')}</div>
    <div><h1>Count the days<br>that matter.</h1><p>Birthdays, trips, firsts and finish lines. Give each one its own photo or color.</p></div>
    <div class="onb-btns"><button class="btn btn-primary" data-act="go" data-arg="choice">Get started</button></div>
  </section>`;
}

// First-launch choice: sits between the Welcome screen and Home. Two equal options; onboarding itself is built later.
function choiceView() {
  const li = items => `<ul class="benefits">${items.map(([ic, t]) => `<li>${icon(ic)}${t}</li>`).join('')}</ul>`;
  return `<section class="view onb choice-view" data-key="choice">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1>Where should your days live?</h1>
    <p>You can change this later in Settings.</p>
    <article class="choice">
      <div class="choice-h"><span class="ci">${icon('lock')}</span><div><b>Use on this device</b><small>No account. Nothing leaves your phone.</small></div></div>
      ${li([['check', 'All your own days, looks, widgets and reminders'], ['check', 'Works offline, no sign-in']])}
      <p class="note"><b>Good to know.</b> Sharing, sync, history and invites need an account.</p>
      <button class="btn btn-primary" data-act="local-start">Use on this device</button>
    </article>
    <article class="choice">
      <div class="choice-h"><span class="ci">${icon('cloud')}</span><div><b>Sign in or create an account</b><small>Free to start. No password.</small></div></div>
      ${li([['share', 'Share days with people you choose'], ['cloud', 'Sync across all your devices'], ['history', 'History, restore and backup']])}
      <button class="btn btn-primary" data-act="signin-prompt" data-arg="welcome">Sign in or create an account</button>
    </article>
    <p class="legal">Creating an account means agreeing to the <a href="#" data-act="toast" data-arg="Opens the Terms of Service">Terms of Service</a> and <a href="#" data-act="toast" data-arg="Opens the Privacy Policy">Privacy Policy</a>.</p>
  </section>`;
}

// ---------- overlays ----------
function qrSVG(seed) {
  const N = 25; let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.8"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.2" fill="var(--surface)"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".8"/>`;
  let r = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const inFinder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    if (!inFinder && rnd() > .5) r += `<rect x="${x}" y="${y}" width="1" height="1" rx=".3"/>`;
  }
  return `<svg class="qr" viewBox="0 0 ${N} ${N}" role="img" aria-label="QR code for the link (placeholder)"><g fill="var(--ink)">${r}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</g></svg>`;
}
const sheetHead = (t, sub = '') => `<div class="sheet-h"><span>${t}${sub ? `<small>${sub}</small>` : ''}</span><button data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>`;
const EXPIRY = [['5', '5 days'], ['30', '30 days'], ['never', 'Never'], ['custom', 'Custom…']];
const expiryText = k => k === 'never' ? 'Never' : k === 'custom' ? fmtDate(addDays(today(), 90)) : fmtDate(addDays(today(), +k));

function shareBody(ev) {
  const sh = S.share;
  if (sh.tab === 'image' || !isOwner(ev)) return `<div class="seg" style="margin-bottom:12px">${[['story', 'Story 9:16'], ['banner', 'Banner 1.91:1']].map(([k, n]) => `<button data-act="share-format" data-arg="${k}" ${pressed(sh.format, k)}>${n}</button>`).join('')}</div>
    <div class="share-prev">${card(ev, sh.format)}</div>
    <div class="switch-row" style="margin-bottom:12px"><div><b>Watermark</b><small>“Tracked with Days That Matter”</small></div><button class="switch" role="switch" aria-label="Watermark" aria-checked="${sh.watermark}" data-act="watermark"></button></div>
    <div class="btn-row"><button class="btn btn-ghost" data-act="toast" data-arg="Saved to Photos">${icon('download')}Save</button><button class="btn btn-primary" data-act="toast" data-arg="System share sheet with the image">${icon('share')}Share</button></div>
    ${isOwner(ev) ? '' : `<p class="note center">Only ${esc(ev.owner.name)} can create links and invites.</p>`}`;
  if (sh.tab === 'link') return `${ev.links.map((l, i) => `<div class="lrow">${icon('link')}<div class="cl"><b>${esc(l.label || 'Public link')}</b><small>daysthatmatter.app/e/${l.token.slice(0, 6)}… · expires ${esc(l.expires)}</small></div>
      <button class="mini-btn" data-act="toast" data-arg="Link copied" aria-label="Copy">${icon('copy')}</button><button class="mini-btn" data-act="revoke-link" data-arg="${i}" aria-label="Revoke">${icon('trash')}</button></div>`).join('')}
    ${sh.newLink ? `<div class="form-card"><input class="input" data-field="link-label" placeholder="Label (optional), like “Instagram”" value="${esc(sh.linkLabel)}">
      <div class="flabel" style="margin-top:12px">Expires</div>${chips(EXPIRY, 'link-expiry', sh.linkExpiry)}
      <button class="btn btn-primary" data-act="create-link" style="margin-top:14px">Create and copy link</button></div>`
      : `<button class="btn btn-ghost" data-act="new-link" ${ev.links.length >= 10 ? 'disabled' : ''}>${icon('plus')}New public link</button>`}
    ${ev.links[0] ? `<div class="qr-wrap">${qrSVG(ev.links[0].token)}<div><b>Scan to open</b><p class="note" style="margin-top:4px">“${esc(ev.links[0].label || 'Public link')}”. Made on the phone, works offline.</p></div></div>` : ''}
    <div class="info">${icon('info')}<span>Anyone with a link sees this day live, no account needed: title, date, time, zone, unit, repeat, look, photo and built-in music. <b>Notes, memos, category and pin stay private.</b> Your own music files play for invited people only. Up to 10 links. The web page is view-only.</span></div>`;
  const inv = ev.invites.map((x, i) => `<div class="lrow">${icon('people')}<div class="cl"><b>${x.role === 'editor' ? 'Editor' : 'Viewer'} invite</b><small>${x.uses === 'unlimited' ? `${x.used} joined · unlimited` : `${x.uses - x.used} of ${x.uses} left`} · expires ${esc(x.expires)}</small></div>
      <button class="mini-btn" data-act="toast" data-arg="Invite link copied" aria-label="Copy">${icon('copy')}</button><button class="mini-btn" data-act="revoke-invite" data-arg="${i}" aria-label="Revoke">${icon('trash')}</button></div>`).join('');
  const members = ev.members.map((m, i) => `<div class="lrow"><span class="av ${i % 2 ? 'alt' : ''}">${esc(m.name[0])}</span><div class="cl"><b>${esc(m.name)}</b></div>
      <div class="seg sm">${[['viewer', 'Viewer'], ['editor', 'Editor']].map(([k, n]) => `<button data-act="member-role" data-arg="${i}:${k}" ${pressed(m.role, k)}>${n}</button>`).join('')}</div>
      <button class="mini-btn" data-act="remove-member" data-arg="${i}" aria-label="Remove ${esc(m.name)}">${icon('close')}</button></div>`).join('');
  return `<div class="form-card"><div class="flabel">Role</div><div class="seg">${[['viewer', 'Viewer · sees it live'], ['editor', 'Editor · can change it']].map(([k, n]) => `<button data-act="invite-role" data-arg="${k}" ${pressed(sh.inviteRole, k)}>${n}</button>`).join('')}</div>
      <div class="flabel" style="margin-top:12px">How many people</div>${chips([['1', '1'], ['5', '5'], ['10', '10'], ['unlimited', 'Unlimited'], ['custom', 'Custom…']], 'invite-uses', sh.inviteUses)}
      <div class="flabel" style="margin-top:12px">Expires</div>${chips(EXPIRY, 'invite-expiry', sh.inviteExpiry)}
      <button class="btn btn-primary" data-act="create-invite" style="margin-top:14px">${icon('share')}Create and send invite</button></div>
    ${inv ? `<p class="group-label flush">Open invites</p>${inv}` : ''}
    <p class="group-label flush">People · ${ev.members.length + 1} of 100</p>
    <div class="lrow"><span class="av">${esc(initial())}</span><div class="cl"><b>You</b></div><span class="cv">Owner</span></div>${members}
    ${ev.removed.map((m, i) => `<div class="lrow muted"><span class="av">${esc(m.name[0])}</span><div class="cl"><b>${esc(m.name)}</b><small>Removed · can't rejoin through invites</small></div><button class="txt-btn" data-act="allow-again" data-arg="${i}">Allow again</button></div>`).join('')}
    <p class="note">Invites open in the app. Without the app, the link shows a page to get it; there is no sign-in or editing on the web. Opening an invite takes no use; joining takes one.</p>`;
}

const SHEETS = {
  actions: ({ id }) => {
    const ev = byId(id), r = role(ev);
    const item = (act, ic, label, extra = '', cls = '') => `<button class="menu-item ${cls}" data-act="${act}" data-arg="${id}">${icon(ic)}<span class="sp">${label}</span>${extra}</button>`;
    return `<div class="sheet-card">${card(ev, 'row')}</div>
      ${r === 'owner' ? item('pin', 'pin', ev.pinned ? 'Unpin' : 'Pin to top', ev.pinned ? '' : `<small>${pins().length} pinned</small>`) : ''}
      ${r !== 'viewer' ? item('edit', 'palette', r === 'owner' ? 'Customize' : 'Edit') : ''}
      ${ev.kind === 'smart' ? '' : item('share', 'share', r === 'owner' ? 'Share' : 'Share image')}
      ${item('archive', 'archive', ev.archived ? 'Unarchive' : 'Archive', ev.pinned && !ev.archived ? '<small>also unpins it</small>' : '')}
      ${r !== 'viewer' && S.account ? item('history', 'history', 'History') : ''}
      ${r === 'owner' ? item('duplicate', 'duplicate', 'Duplicate') + item('delete', 'trash', 'Delete', '', 'danger')
        : item('report', 'flag', 'Report') + item('leave', 'leave', 'Leave', '', 'danger')}`;
  },
  newday: () => {
    const y = today().getFullYear(), md = toISO(today()).slice(5);
    return `${sheetHead('New day')}
      <button class="menu-item" data-act="new-date">${icon('calendar')}<span class="sp">A date<small class="sub">Birthday, trip, anniversary, deadline</small></span>${icon('chev')}</button>
      <p class="group-label flush">Smart days<span class="new">New</span></p>
      ${Object.entries(SMART).map(([k, sd]) => `<button class="menu-item" data-act="new-smart" data-arg="${k}"><span class="emo-i">${sd.emoji}</span><span class="sp">${sd.title(y)}<small class="sub">${sd.hint}</small></span><b class="cv">${fmt(smartCount(k))}</b></button>`).join('')}
      <p class="group-label flush">Seasonal · limited time</p>
      ${SEASONAL.map(se => { const open = md >= se.from && md <= se.to; return `<button class="menu-item" ${open ? `data-act="new-season" data-arg="${se.id}"` : 'disabled'}><span class="emo-i">${se.emoji}</span><span class="sp">${se.title}<small class="sub">${open ? `Available until ${se.toText}` : `Opens ${se.fromText}`}</small></span></button>`; }).join('')}
      <p class="note">Smart days count from a rule and update every day. Holiday sets will come from the server per region; this one is a sample. Smart days can't be shared yet.</p>`;
  },
  sort: () => `${sheetHead('Sort')}
    ${SORTS.map(([k, n]) => `<button class="menu-item" data-act="sort" data-arg="${k}"><span class="sp">${n}</span>${S.sort === k ? icon('check') : ''}</button>`).join('')}
    <p class="note">Drag to reorder needs a sort field on Event (see README, gaps).</p>`,
  share: ({ id }) => {
    const ev = byId(id), own = isOwner(ev);
    return `${sheetHead(`Share “${esc(ev.title)}”`, own ? 'Links update live when the day changes' : '')}
      ${own ? `<div class="seg" style="margin-bottom:14px">${[['link', 'Public link'], ['people', 'People'], ['image', 'Image']].map(([k, n]) => `<button data-act="share-tab" data-arg="${k}" ${pressed(S.share.tab, k)}>${n}</button>`).join('')}</div>` : ''}
      ${shareBody(ev)}`;
  },
  history: ({ id }) => {
    const ev = byId(id), own = isOwner(ev), revs = (S.history[id] || []).filter(r => own || !r.ownerOnly);
    return `${sheetHead('History', 'Every saved change. Restoring adds a revision; nothing is lost.')}
      ${revs.length ? revs.map((r, i) => `<div class="hist"><span class="av ${r.by === 'You' ? '' : 'alt'}">${esc(r.by[0])}</span><div class="cl">
        <div class="memo-meta"><b>${esc(r.by)}</b><span>${esc(r.when)}</span><span class="tag">Rev ${r.rev}</span>${r.ownerOnly ? '<span class="ms">only you see this</span>' : ''}</div>
        ${r.changes.map(([f, a, b]) => `<div class="chg"><span>${esc(f)}</span><s>${esc(a)}</s>${icon('send', 'mini')}<b>${esc(b)}</b></div>`).join('')}</div>
        ${i === 0 ? '<span class="cv">Current</span>' : r.ownerOnly ? '' : `<button class="txt-btn" data-act="restore-rev" data-arg="${r.rev}">Restore</button>`}</div>`).join('')
      : '<p class="note">No changes yet. History starts when the day syncs.</p>'}`;
  },
  signin: ({ reason, step, email }) => {
    if (step === 'email') return `${sheetHead('Continue with email')}<p class="sheet-p">We'll send a 6-digit code. No password.</p>
      <input class="input" type="email" data-field="email" placeholder="you@example.com" value="${esc(email || '')}" autocomplete="email"><button class="btn btn-primary" data-act="send-code" style="margin-top:12px">Send code</button>${legal()}`;
    if (step === 'code') return `${sheetHead('Enter the code')}<p class="sheet-p">Sent to <b>${esc(email)}</b>. Valid for 10 minutes.</p>
      <input class="input code" inputmode="numeric" maxlength="6" data-field="code" placeholder="••••••" autocomplete="one-time-code"><button class="btn btn-primary" data-act="verify-code" style="margin-top:12px">Sign in</button>
      <button class="btn btn-text" data-act="send-code">Send a new code</button>`;
    const why = { share: 'Sharing needs an account. Your days upload when you sign in, then you can share.', first: 'Keep this day safe and see it on all your devices.', sync: 'Sync your days to all your devices.', settings: 'Sync your days to all your devices and share them.',
      history: 'History and restore need an account, so every change can be saved and brought back.', backup: 'Your days are backed up in your account, and you can download them any time.',
      welcome: 'Create your account or sign in. Your days sync to all your devices.', nudge: 'Share days, sync across your devices and keep a backup. Your days here stay yours until you choose to import them.' }[reason];
    return `${sheetHead('Sign in or create an account')}<p class="sheet-p">${why}</p>${signInButtons()}${reason === 'share' ? '' : '<button class="btn btn-text" data-act="close-sheet">Not now</button>'}${legal()}`;
  },
  paywall: ({ g }) => {
    if (g.limit) {
      return `${sheetHead(g.title)}<p class="sheet-p">${esc(g.text)}</p>${g.alt ? `<button class="btn btn-primary" data-act="paywall-alt">${esc(g.alt.label)}</button>` : ''}<button class="btn btn-text" data-act="close-sheet">OK</button>`;
    }
    const benefits = [
      '500 events',
      '300 photo backdrops, 30 Live Photos',
      'The whole music catalog',
      'Your own songs, up to 20',
    ];
    if (getLimits('premium').spotify !== undefined) {
      benefits.push('Spotify on any number of events');
    }
    return `<div class="pw-hero">${icon('sparkle')}<span>Premium</span><button data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
      <h2 class="pw-title">${esc(g.title)}</h2><p class="sheet-p">${esc(g.text)}</p>
      <ul class="benefits">${benefits.map(t => `<li>${icon('check')}${t}</li>`).join('')}</ul>
      <div class="plan-opts">${[['year', 'Yearly'], ['month', 'Monthly']].map(([k, n]) => `<button data-act="billing" data-arg="${k}" ${pressed(S.billing, k)}><b>${n}</b><small>Price from the store</small></button>`).join('')}</div>
      <button class="btn btn-primary" data-act="upgrade">Upgrade to Premium</button>
      ${g.alt ? `<button class="btn btn-ghost" data-act="paywall-alt" style="margin-top:8px">${esc(g.alt.label)}</button>` : ''}
      <div class="pw-foot"><button data-act="restore">Restore purchases</button><button data-act="close-sheet">Not now</button></div>
      <p class="note center">Billed by Apple or Google; cancel in your store settings. People you share with never need Premium to see it. Ending a plan never removes anything.</p>`;
  },
  // Heavy-use nudge (local mode only). Calm: one primary, a clear Not now, and a line saying how often it can return.
  nudge: () => { const lc = localCount(); return `${sheetHead('Your days deserve a backup')}
    <p class="sheet-p">You are keeping <b>${plural(lc.days, 'day')}</b> and <b>${plural(lc.memos, 'memo')}</b> on this phone. An account adds:</p>
    <ul class="benefits">${[['share', 'Sharing with the people you choose'], ['cloud', 'Sync across your devices'], ['history', 'History, so any change can be restored'], ['archive', 'A backup if this phone is lost']].map(([ic, t]) => `<li>${icon(ic)}${t}</li>`).join('')}</ul>
    <button class="btn btn-primary" data-act="nudge-yes">Sign in or create an account</button>
    <button class="btn btn-text" data-act="nudge-no">Not now</button>
    <p class="note center">Your days stay on this phone until you decide to import them. We won't ask again for a month.</p>`; },
  // Import after sign-in, from Settings, and the follow-up states. Same wording in all places.
  import: ({ step, n, memos: m }) => {
    const lc = localCount(), acct = esc(S.account?.email || '');
    const rows = S.localEvents.slice(0, 3).map(e => `<div class="lrow"><span class="emo-i">${e.emoji}</span><div class="cl"><b>${title(e)}</b><small>${esc(meta(e, calc(e)))}${e.memos.length ? ` · ${plural(e.memos.length, 'memo')}` : ''}</small></div></div>`).join('') + (lc.days > 3 ? `<div class="lrow"><div class="cl"><small>and ${lc.days - 3} more</small></div></div>` : '');
    if (step === 'confirm') return `${sheetHead('This can’t be undone')}
      <p class="sheet-p">Import ${plural(lc.days, 'day')} and ${plural(lc.memos, 'memo')} into <b>${acct}</b>?</p>
      <ul class="benefits">${[['check', 'They are saved to your account and sync to your other devices.'], ['lock', 'They are removed from local mode on this phone. Signing out later will not bring them back here.'], ['info', 'You can’t move them back. Delete or edit them in your account as you would any day.']].map(([ic, t]) => `<li>${icon(ic)}${t}</li>`).join('')}</ul>
      <button class="btn btn-primary" data-act="import-yes">Yes, import ${plural(lc.days, 'day')}</button>
      <button class="btn btn-text" data-act="import-back">Go back</button>`;
    if (step === 'progress') return `${sheetHead('Importing events')}
      <div class="empty"><div class="spinner"></div><b style="margin-top:16px">Importing ${plural(n, 'event')}…</b><p class="sheet-p center" style="margin-top:6px">Please keep the app open while events are being imported.</p><div class="meter" style="max-width:200px;margin:14px auto 0"><i class="progress-bar" style="width:68%"></i></div></div>`;
    if (step === 'done') return `<div class="empty"><div class="big">✅</div><b>${plural(n, 'event')} imported</b><p class="sheet-p center" style="margin-top:8px">${plural(m, 'memo')} came with ${n === 1 ? 'it' : 'them'}. ${n === 1 ? 'It is' : 'They are'} in your account now and will appear on your other devices. ${n === 1 ? 'It is' : 'They are'} no longer in local mode on this phone.</p></div>
      <button class="btn btn-primary" data-act="import-done">Done</button>`;
    if (step === 'failed') return `<div class="empty"><div class="big">⚠️</div><b>We couldn’t import your events. Nothing has changed on this device.</b></div>
      <button class="btn btn-primary" data-act="import-retry">Try again</button>
      <button class="btn btn-text" data-act="import-done" style="margin-top:8px">Not now</button>`;
    if (step === 'cannot') return `<div class="empty"><div class="big">⚠️</div><b>These events can’t be imported yet. This version of the service doesn’t support something in them, so they stay on this device. We’ve noted it so it can be fixed.</b></div>
      <button class="btn btn-primary" data-act="import-done">OK</button>`;
    return `${sheetHead('Import this phone’s days?', `Found ${plural(lc.days, 'day')} and ${plural(lc.memos, 'memo')} kept on this device`)}
      <div class="form-card">${rows}</div>
      <p class="sheet-p">Importing moves them into your account, so they sync to your other devices. It is permanent: they leave local mode on this phone and can’t be moved back. If you choose not now, nothing is imported.</p>
      <button class="btn btn-primary" data-act="import-go">Import ${plural(lc.days, 'day')}…</button>
      <button class="btn btn-ghost" data-act="import-later" style="margin-top:8px">Not now, keep on this device</button>
      <p class="note center">They stay here and are not shown in your account. You can import them later from Settings.</p>`;
  },
  'file-import': ({ step, n = 4, memos = 2 }) => {
    if (step === 'pick') return `${sheetHead('Choose a file')}
      <p class="sheet-p">Select a backup file to import events from.</p>
      <div class="form-card">
        <button class="cell" data-act="file-import-chosen" style="text-align:left;width:100%"><span class="ci">${icon('archive')}</span><span class="cl"><b>DaysThatMatter-20261015-120000.zip</b><small>4 events · Today at 12:00</small></span><span class="cv">${icon('chev')}</span></button>
      </div>
      <button class="btn btn-text" data-act="close-sheet">Cancel</button>`;
    if (step === 'confirm') return `${sheetHead('This can’t be undone')}
      <p class="sheet-p">Import 4 events from <b>DaysThatMatter-20261015-120000.zip</b> into ${S.account ? 'your account' : 'this device'}?</p>
      <ul class="benefits">${[['check', 'Events and memos in the file will be added.'], ['info', 'Existing events will not be overwritten.']].map(([ic, t]) => `<li>${icon(ic)}${t}</li>`).join('')}</ul>
      <button class="btn btn-primary" data-act="file-import-yes">Yes, import 4 events</button>
      <button class="btn btn-text" data-act="file-import-back">Go back</button>`;
    if (step === 'progress') return `${sheetHead('Importing events')}
      <div class="empty"><div class="spinner"></div><b style="margin-top:16px">Importing 4 events…</b><p class="sheet-p center" style="margin-top:6px">Please keep the app open while events are being imported.</p><div class="meter" style="max-width:200px;margin:14px auto 0"><i class="progress-bar" style="width:68%"></i></div></div>`;
    if (step === 'done') return `<div class="empty"><div class="big">✅</div><b>4 events imported</b><p class="sheet-p center" style="margin-top:8px">2 memos came with them. They are now available on this device.</p></div>
      <button class="btn btn-primary" data-act="close-sheet">Done</button>`;
    if (step === 'failed') return `<div class="empty"><div class="big">⚠️</div><b>We couldn’t import your events. Nothing has changed on this device.</b></div>
      <button class="btn btn-primary" data-act="file-import-retry">Try again</button>
      <button class="btn btn-text" data-act="close-sheet" style="margin-top:8px">Not now</button>`;
    if (step === 'cannot') return `<div class="empty"><div class="big">⚠️</div><b>These events can’t be imported yet. This version of the service doesn’t support something in them, so they stay on this device. We’ve noted it so it can be fixed.</b></div>
      <button class="btn btn-primary" data-act="close-sheet">OK</button>`;
    if (step === 'too-new') return `<div class="empty"><div class="big">⚠️</div><b>This file needs a newer version of the app. Nothing has changed.</b></div>
      <button class="btn btn-primary" data-act="close-sheet">OK</button>`;
  },
  'export-saved': ({ fname, count }) => `${sheetHead('Saved to Downloads')}
    <div class="empty"><div class="big">📦</div><b>Saved to Downloads: ${esc(fname)}</b>
    <p class="sheet-p center" style="margin-top:8px">Contains ${plural(count, 'event')} from ${S.account ? 'your account' : 'this device'}.</p></div>
    <button class="btn btn-primary" data-act="export-share" data-arg="${esc(fname)}">Share</button>
    <button class="btn btn-text" data-act="close-sheet" style="margin-top:8px">Done</button>`,
  confirm: ({ title: t, text, label, plain, extra }) => `${sheetHead(t)}<p class="sheet-p">${text}</p>${extra || ''}<button class="btn ${plain ? 'btn-primary' : 'btn-danger'}" data-act="confirm-yes">${label}</button><button class="btn btn-text" data-act="close-sheet">Cancel</button>`,
};

function overlays() {
  let html = '';
  if (S.dialog === 'name') {
    const cur = S.dialogName !== undefined ? S.dialogName : (S.account ? (S.account.name || '') : (S.localName || ''));
    const helper = S.account ? 'Shown on your account and in greetings.' : 'Used in greetings. Stays on this device.';
    html += `<div class="scrim" data-act="dialog-cancel"></div><div class="dialog" role="dialog" aria-modal="true">
      <h2 class="dialog-title">What should we call you?</h2>
      <input class="input" data-field="dialog-name" maxlength="40" value="${esc(cur)}" placeholder="Add your name" aria-label="What should we call you?" autocomplete="off">
      <p class="dialog-hint">${helper}</p>
      <div class="btn-row">
        <button class="btn btn-ghost" data-act="dialog-cancel">Cancel</button>
        <button class="btn btn-primary" data-act="dialog-save">Save</button>
      </div>
    </div>`;
  }
  if (S.sheet) html += `<div class="scrim" data-act="close-sheet"></div><div class="sheet ${S.sheet.type}" role="dialog" aria-modal="true"><div class="grabber"></div>${SHEETS[S.sheet.type](S.sheet)}</div>`;
  if (S.toast) html += `<div class="toast" role="status"><span>${esc(S.toast.text)}</span>${S.toast.undo ? '<button data-act="undo">Undo</button>' : ''}</div>`;
  return html;
}

// ---------- render ----------
const VIEWS = { archive: archiveView, home: homeView, detail: detailView, editor: editorView, settings: settingsView, widgets: widgetsView, onboarding: onboardingView, choice: choiceView };

function render() {
  const old = app.querySelector('.view'), oldSheet = app.querySelector('.sheet'), sheetScroll = oldSheet?.scrollTop, hadToast = !!app.querySelector('.toast');
  if (old) scrollMem[old.dataset.key] = scroller(old).scrollTop;
  app.innerHTML = statusbar() + VIEWS[S.screen]() + overlays();
  const v = app.querySelector('.view');
  if (S.anim && S.anim !== 'none') v.classList.add('enter-' + S.anim);
  else v.classList.add('no-anim');
  scroller(v).scrollTop = S.anim && S.anim !== 'back' && S.anim !== 'none' ? 0 : scrollMem[v.dataset.key] || 0;
  if (S.screen === 'home') homeSync();
  const sh = app.querySelector('.sheet');
  // Re-rendering under an open sheet or toast must not replay their entrance.
  if (sh && oldSheet && !S.sheetFresh) { sh.style.animation = app.querySelector('.scrim').style.animation = 'none'; sh.scrollTop = sheetScroll; }
  if (hadToast) app.querySelector('.toast')?.style.setProperty('animation', 'none');
  S.anim = ''; S.motion = false; S.sheetFresh = false;
  if (S.focus) { const el = app.querySelector(S.focus); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } S.focus = null; }
  renderPanel();
}
const scroller = v => v.querySelector('.home-list') || v;

// ---------- pinned carousel ----------
// Side cards shrink toward the centred one and fade; returns the index nearest the centre.
function pinFx(track) {
  const step = track.firstElementChild.offsetWidth + 10, x = track.scrollLeft / step;
  // Scale the card, not the slot: snap areas include transforms, so a scaled slot would pull the snap off centre.
  [...track.children].forEach((s, i) => {
    const d = Math.min(1, Math.abs(i - x)), c = s.firstElementChild.style;
    c.transformOrigin = i < x ? 'right center' : 'left center';
    c.transform = `scale(${1 - d * .08})`; c.opacity = 1 - d * .4;
  });
  return Math.round(x);
}
let autoScroll = false, autoTimer, pinTimer;
// Outline the list row of the centred pin; on a swipe, also scroll the list to it.
function focusRow(scroll) {
  const id = pins()[S.pinIndex]?.id, list = app.querySelector('.home-list');
  app.querySelectorAll('.home-list .is-focus').forEach(el => el.classList.remove('is-focus', 'pulse'));
  const row = id && S.settings.showHero && list?.querySelector(`[data-act="open"][data-arg="${id}"]`);
  if (!row) return;
  row.classList.add('is-focus');
  if (!scroll) return;
  void row.offsetWidth; row.classList.add('pulse');
  autoScroll = true; clearTimeout(autoTimer); autoTimer = setTimeout(() => { autoScroll = false; }, 1000); // cleared early by the list's own scroll events
  const top = list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top - 14;
  list.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
// Collapsing the pinned carousel swaps its whole layout (title row and big number become one strip). Doing that in one frame while the
// card's height still animates reads as a flash, so the card's contents fade out first, the layout switches while they are invisible,
// and they fade back in as the frame settles. Hysteresis (collapse past 32, expand below 8) stops it chattering near the threshold.
const COMPACT_ON = 32, COMPACT_OFF = 8, SWAP_MS = 90;
let compactTimer;
function wantCompact(home, list) { const on = home.classList.contains('compact'); return on ? list.scrollTop >= COMPACT_OFF : list.scrollTop > COMPACT_ON; }
function setCompact(home, list) {
  if (!home || home.classList.contains('swap')) return;
  const target = wantCompact(home, list);
  if (target === home.classList.contains('compact')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { home.classList.toggle('compact', target); return; }
  // Commit to the decision made now (re-reading the scroll position at the end would sometimes cancel it after the fade-out had
  // already started, which is a blink with no change), then look again once the swap is done in case the user moved on.
  home.classList.add('swap');
  clearTimeout(compactTimer);
  compactTimer = setTimeout(() => { home.classList.toggle('compact', target); requestAnimationFrame(() => { home.classList.remove('swap'); setCompact(home, list); }); }, SWAP_MS);
}
function homeSync() {
  const list = app.querySelector('.home-list'), track = app.querySelector('.pins');
  app.querySelector('.home').classList.toggle('compact', list.scrollTop > 24);
  if (track) { track.scrollLeft = S.pinIndex * (track.firstElementChild.offsetWidth + 10); pinFx(track); }
  focusRow(false);
}
const scrollPins = i => { const t = app.querySelector('.pins'); t.scrollTo({ left: i * (t.firstElementChild.offsetWidth + 10), behavior: 'smooth' }); };

const openSheet = sheet => { S.sheet = sheet; S.sheetFresh = true; render(); };

function go(screen, anim = 'right') { S.stack.push(S.screen); S.screen = screen; S.anim = anim; S.sheet = null; S.dialog = null; render(); }
function back() { if (S.screen === 'detail') S.playing = false; S.screen = S.stack.pop() || 'home'; S.anim = 'back'; S.sheet = null; S.dialog = null; render(); }
function jump(screen) { S.stack = screen === 'home' || screen === 'onboarding' ? [] : screen === 'choice' ? ['onboarding'] : ['home']; S.screen = screen; S.anim = 'fade'; S.sheet = null; S.dialog = null; render(); }

let toastTimer;
function toast(text, undo) {
  S.toast = { text, undo }; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; app.querySelector('.toast')?.remove(); }, 4200);
}

function refreshPreview() {
  const p = app.querySelector('#preview'); if (p) p.innerHTML = previewHTML();
  const ci = app.querySelector('#contrast');
  if (ci) { const info = contrastInfo(S.draft.look); ci.className = `contrast ${info.ok ? '' : 'warn'}`; ci.innerHTML = `<i></i>${esc(info.text)}`; }
}

function applyTheme() {
  const r = document.documentElement, t = S.settings.theme;
  if (t === 'system') delete r.dataset.theme; else r.dataset.theme = t;
  r.dataset.accent = S.settings.accent;
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti';
  const cols = ['#FFD166', '#06D6A0', '#4CC9F0', '#F78C6B', '#B794F4'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('i');
    s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * .7}s;rotate:${Math.random() * 360}deg`;
    box.append(s);
  }
  app.append(box); setTimeout(() => box.remove(), 3400);
}

// Sync runs on its own within 2 s of a saved edit (event-sync spec).
let syncTimer;
function queueSync(n = 1) {
  if (!S.account) return;
  S.pending += n; clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { S.pending = 0; S.lastSync = Date.now(); if (!S.sheet && S.screen !== 'editor') render(); }, 1800);
}

// ---------- gating (premium spec: the writer's own plan, paywall on Save) ----------
function gate(d, prev) {
  const L = LIMITS[S.plan], u = usage(d.id), free = S.plan === 'free', bg = d.look.bg, pbg = prev?.look.bg;
  const wall = (feature, alt) => {
    const [t, text, noun] = WALLS[feature];
    return free || L[feature] === undefined ? { feature, title: t, text, alt } : { feature, limit: true, title: 'Limit reached', text: `Premium includes up to ${L[feature]} ${noun}. Remove one to add another.`, alt };
  };
  const keepLook = { label: prev ? 'Keep the previous background' : 'Save without the photo', fix: x => { x.look = prev ? structuredClone(prev.look) : defaultLook(); } };
  const keepAudio = { label: 'Keep the previous music', fix: x => { x.audio = prev ? structuredClone(prev.audio) : null; } };
  if (!prev && isOwner(d) && u.events >= L.events) return wall('events');
  if (bg.type === 'photo' && pbg?.type !== 'photo' && isOwner(d) && u.photos >= L.photos) return wall('photos', keepLook);
  if (bg.animated && !(pbg?.animated && pbg.src === bg.src) && u.animated >= L.animated) return wall('animated', { label: 'Use still photo', fix: x => { x.look.bg.animated = false; } });
  const a = d.audio, pa = prev?.audio;
  if (a && JSON.stringify(a) !== JSON.stringify(pa)) {
    if (a.type === 'track' && track(a.id).premium && free) return wall('premium_audio', keepAudio);
    if (a.type === 'file' && (free || (a.isNew && u.files >= L.files))) return wall('files', keepAudio);
    if (a.type === 'spotify' && pa?.type !== 'spotify' && L.spotify !== undefined && u.spotify >= L.spotify) return wall('spotify', keepAudio);
  }
  return null;
}
const defaultLook = () => ({ bg: { type: 'gradient', id: 'lagoon' }, dim: 0, blur: 0, style: 'glass', font: 'sans', text: 'auto', size: 'md' });

// ---------- actions ----------
function openEditor(id, tab = 'details', preset = null) {
  const src = id && byId(id);
  if (!src && usage().events >= LIMITS[S.plan].events) return openSheet({ type: 'paywall', g: gate({ id: '', look: defaultLook() }, null) });
  S.draft = src ? structuredClone(src) : {
    id: 'e' + Date.now().toString(36), title: '', emoji: '✨', date: toISO(addDays(today(), 30)), time: null, zone: DEVICE_TZ, repeat: 'none', every: 10, category: 'life',
    pinned: false, unit: 'auto', created: toISO(today()), reminder: 'day', audio: null, notes: '', memos: [], owner: null, role: 'owner', members: [], removed: [], links: [], invites: [],
    kind: 'date', rule: null, archived: false, look: defaultLook(), ...preset,
  };
  S.edTab = tab; S.bgTab = S.draft.look.bg.type; S.soundTab = S.draft.audio?.type === 'spotify' ? 'spotify' : S.draft.audio?.type === 'file' ? 'library' : 'builtin';
  S.prevCtx = S.draft.pinned ? 'hero' : 'row'; S.trackPreview = null;
  go('editor', 'up');
}

function setPinned(id, on) {
  const ev = byId(id), before = { pinned: ev.pinned, pinnedAt: ev.pinnedAt };
  ev.pinned = on;
  if (on) { ev.pinnedAt = Date.now(); S.pinIndex = 0; }
  toast(on ? `Pinned “${ev.title}”. It stays in the list too.` : `Unpinned “${ev.title}”`, () => Object.assign(ev, before));
}

function signIn(method) {
  S.account = { ...ACCOUNT, methods: [method] }; S.sheet = null;
  const then = S.after; S.after = null;
  if (['onboarding', 'choice'].includes(S.screen)) jump('home');
  // Local days found on this device: ask before anything moves. Nothing is uploaded automatically.
  if (S.localEvents.length && S.importChoice !== 'skipped') {
    toast(`Signed in with ${methodName(method)}.`); S.afterImport = then;
    return openSheet({ type: 'import', step: 'ask' });
  }
  toast(`Signed in with ${methodName(method)}.`);
  if (then) then(); else render();
}

function exportFileName() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const hms = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `DaysThatMatter-${ymd}-${hms}.zip`;
}

// Import is all-or-nothing: progress state, then either all move or none move.
let importTimer = null;
function startImportFlow(isFile = false) {
  const count = isFile ? 4 : S.localEvents.length;
  const memos = isFile ? 2 : S.localEvents.reduce((n, e) => n + e.memos.length, 0);
  S.sheet = { type: isFile ? 'file-import' : 'import', step: 'progress', n: count, memos, isFile };
  S.sheetFresh = true;
  render();
  if (importTimer) clearTimeout(importTimer);
  importTimer = setTimeout(() => {
    finishImportFlow(isFile, count, memos);
  }, 1200);
}

function finishImportFlow(isFile, n, memos) {
  importTimer = null;
  const res = S.importResult || 'ok';
  if (res === 'ok') {
    if (!isFile) {
      S.accountEvents.push(...S.localEvents.map(e => ({ ...structuredClone(e), imported: true })));
      S.localEvents = [];
      S.importChoice = 'imported';
      queueSync(n);
    }
    S.sheet = { type: isFile ? 'file-import' : 'import', step: 'done', n, memos, isFile };
  } else if (res === 'fail') {
    S.sheet = { type: isFile ? 'file-import' : 'import', step: 'failed', n, memos, isFile };
  } else if (res === 'cannot') {
    S.sheet = { type: isFile ? 'file-import' : 'import', step: 'cannot', n, memos, isFile };
  } else if (res === 'new') {
    S.sheet = { type: isFile ? 'file-import' : 'import', step: isFile ? 'too-new' : 'cannot', n, memos, isFile };
  }
  S.sheetFresh = true;
  render();
}

function closeImport(choice) {
  if (importTimer) { clearTimeout(importTimer); importTimer = null; }
  const f = S.afterImport; S.afterImport = null; S.sheet = null;
  if (choice) S.importChoice = choice;
  if (f) f(); else render();
}
// Panel helpers: put the prototype in a state so a reviewer can look at it without playing through.
const ensureSigned = () => { if (!S.account) { S.account = { ...ACCOUNT }; S.filter = 'all'; } };
function setLocalDays(some) {
  S.accountEvents = S.accountEvents.filter(e => !e.imported);
  S.localEvents = some ? seedLocal() : [];
  if (S.importChoice === 'imported') S.importChoice = 'none';
}

function pushRevision(prev, d) {
  if (!S.account || !prev) return;
  const ch = [['Title', 'title'], ['Emoji', 'emoji'], ['Date', 'date'], ['Time', 'time'], ['Time zone', 'zone'], ['Repeat', 'repeat'], ['Unit', 'unit']]
    .filter(([, k]) => prev[k] !== d[k]).map(([f, k]) => [f, prev[k] ?? '—', d[k] ?? '—']);
  if (JSON.stringify(prev.look) !== JSON.stringify(d.look)) ch.push(['Look', prev.look.bg.type, d.look.bg.animated ? 'Live photo' : d.look.bg.type]);
  if (JSON.stringify(prev.audio) !== JSON.stringify(d.audio)) ch.push(['Music', audioName(prev.audio), audioName(d.audio)]);
  if (!ch.length) return;
  const list = S.history[d.id] ||= [];
  list.unshift({ rev: (list[0]?.rev || 0) + 1, by: 'You', when: 'Just now', changes: ch });
}

const removeEvent = (id, msg) => {
  const i = S.events.findIndex(e => e.id === id), [ev] = S.events.splice(i, 1);
  S.sheet = null; toast(msg(ev), () => S.events.splice(i, 0, ev));
  if (S.screen === 'detail') back(); else render();
};

const ACT = {
  go: a => go(a),
  back,
  open: a => { S.detailId = a; S.playing = false; S.motion = true; go('detail'); if (calc(byId(a)).today) setTimeout(confetti, 250); },
  motion: (a, el) => { if (!byId(S.detailId).look.bg.animated) return; const bg = el.querySelector('.card-bg'); bg.classList.remove('motion'); void bg.offsetWidth; bg.classList.add('motion'); },
  'pin-card': a => +a === S.pinIndex ? ACT.open(pins()[+a].id) : scrollPins(+a),
  'pin-go': a => scrollPins(+a),
  new: () => usage().events >= LIMITS[S.plan].events ? openSheet({ type: 'paywall', g: gate({ id: '', look: defaultLook() }, null) }) : openSheet({ type: 'newday' }),
  'new-date': () => { S.sheet = null; openEditor(null); },
  'new-smart': a => { const y = today().getFullYear(); S.sheet = null; openEditor(null, 'details', { kind: 'smart', rule: a, title: SMART[a].title(y), emoji: SMART[a].emoji, date: `${y}-12-31`, category: null, reminder: 'none', look: { ...defaultLook(), bg: { type: 'gradient', id: 'meadow' } } }); },
  'new-season': a => { const se = SEASONAL.find(x => x.id === a); S.sheet = null; openEditor(null, 'details', { title: se.title, emoji: se.emoji, date: se.date(today().getFullYear()), category: 'holiday', look: { ...defaultLook(), bg: se.bg } }); },
  archive: a => {
    const ev = byId(a || S.detailId), was = { archived: ev.archived, pinned: ev.pinned };
    ev.archived = !ev.archived;
    if (ev.archived) ev.pinned = false;
    S.sheet = null; queueSync();
    toast(ev.archived ? `Archived “${ev.title}”.${was.pinned ? ' It’s no longer pinned.' : ''}` : `“${ev.title}” is back on Home`, () => Object.assign(ev, was));
    render();
  },
  size: a => { S.draft.look.size = a; S.prevCtx = 'row'; render(); },
  'lib-use': a => { const l = S.library.find(x => x.id === a); S.draft.audio = { type: 'file', id: l.id, title: l.title, dur: l.dur }; render(); },
  'lib-remove': a => {
    const l = S.library.find(x => x.id === a), n = libUsedBy(a);
    l.removed = true;
    toast(`Removed “${l.title}” from your library.${n ? ` ${n === 1 ? 'The day that uses it keeps' : `The ${n} days that use it keep`} playing it.` : ''}`, () => { l.removed = false; });
    render();
  },
  edit: a => openEditor(a || S.detailId),
  'edit-sound': () => openEditor(S.detailId, 'sound'),
  search: () => { S.searching = !S.searching; if (!S.searching) S.query = ''; else S.focus = '.search input'; render(); },
  filter: a => { S.filter = a; render(); },
  layout: () => { S.layout = S.layout === 'list' ? 'grid' : 'list'; render(); },
  'layout-set': a => { S.layout = a; render(); },
  'sort-menu': () => openSheet({ type: 'sort' }),
  sort: a => { S.sort = a; S.sheet = null; render(); },
  more: a => openSheet({ type: 'actions', id: a }),
  pin: a => { S.sheet = null; setPinned(a, !byId(a).pinned); queueSync(); render(); },
  delete: a => removeEvent(a, ev => `Deleted “${ev.title}”`),
  leave: a => removeEvent(a || S.detailId, ev => `You left “${ev.title}”. Ask ${ev.owner.name} for a new invite to come back.`),
  report: () => { S.sheet = null; toast('Report sent. We review reports within 24 hours.'); render(); },
  duplicate: a => {
    if (usage().events >= LIMITS[S.plan].events) return openSheet({ type: 'paywall', g: gate({ id: '', look: defaultLook() }, null) });
    const copy = { ...structuredClone(byId(a)), id: 'e' + Date.now().toString(36), pinned: false, memos: [], members: [], removed: [], links: [], invites: [], created: toISO(today()) };
    copy.title = `${copy.title} (copy)`.slice(0, 100); S.events.push(copy); S.sheet = null; toast('Duplicated'); queueSync(); render();
  },
  share: a => {
    const id = a || S.detailId, ev = byId(id);
    if (isOwner(ev) && !S.account) { S.after = () => openSheet({ type: 'share', id }); return openSheet({ type: 'signin', reason: 'share' }); }
    S.share.newLink = false; openSheet({ type: 'share', id });
  },
  'share-tab': a => { if (S.sheet?.type !== 'share') { if (!S.account) return ACT.share(); S.sheet = { type: 'share', id: S.detailId }; S.sheetFresh = true; } S.share.tab = a; S.share.newLink = false; render(); },
  'share-format': a => { S.share.format = a; render(); },
  watermark: () => { S.share.watermark = !S.share.watermark; render(); },
  'new-link': () => { S.share.newLink = true; S.share.linkLabel = ''; render(); },
  'link-expiry': a => { S.share.linkExpiry = a; render(); },
  'create-link': () => {
    const ev = byId(S.sheet.id);
    ev.links.push({ label: S.share.linkLabel.trim(), token: Math.random().toString(36).slice(2, 13) + Math.random().toString(36).slice(2, 13), expires: expiryText(S.share.linkExpiry) });
    S.share.newLink = false; toast('Link created and copied'); render();
  },
  'revoke-link': a => {
    const ev = byId(S.sheet.id), l = ev.links[+a];
    S.sheet = { type: 'confirm', title: 'Revoke this link?', text: `“${esc(l.label || 'Public link')}” will show “no longer available”. Other links and people keep access. This can't be undone.`, label: 'Revoke link',
      then: () => { ev.links.splice(+a, 1); toast('Link revoked'); S.sheet = { type: 'share', id: ev.id }; } };
    render();
  },
  'invite-role': a => { S.share.inviteRole = a; render(); },
  'invite-uses': a => { S.share.inviteUses = a; render(); },
  'invite-expiry': a => { S.share.inviteExpiry = a; render(); },
  'create-invite': () => {
    const ev = byId(S.sheet.id), u = S.share.inviteUses;
    ev.invites.unshift({ role: S.share.inviteRole, uses: u === 'unlimited' ? 'unlimited' : u === 'custom' ? 20 : +u, used: 0, expires: expiryText(S.share.inviteExpiry), token: '' });
    toast('Invite ready. System share sheet opens to send it.'); render();
  },
  'revoke-invite': a => { byId(S.sheet.id).invites.splice(+a, 1); toast('Invite revoked. People who joined keep access.'); render(); },
  'member-role': a => { const [i, r] = a.split(':'), m = byId(S.sheet.id).members[+i]; m.role = r; toast(`${m.name} is now ${r === 'editor' ? 'an editor' : 'a viewer'}`); render(); },
  'remove-member': a => {
    const ev = byId(S.sheet.id), [m] = ev.members.splice(+a, 1);
    ev.removed.push({ name: m.name }); toast(`Removed ${m.name}. Their open pages lose access.`); render();
  },
  'allow-again': a => { const [m] = byId(S.sheet.id).removed.splice(+a, 1); toast(`${m.name} can join through an invite again`); render(); },
  history: a => openSheet({ type: 'history', id: a || S.detailId }),
  'restore-rev': a => {
    const list = S.history[S.sheet.id]; list.unshift({ rev: list[0].rev + 1, by: 'You', when: 'Just now', changes: [['Restored', `Rev ${list[0].rev}`, `Rev ${a}`]] });
    toast(`Restored revision ${a}. Saved as revision ${list[0].rev}.`); render();
  },
  'close-sheet': () => {
    if (S.sheet?.type === 'import') return S.sheet.step === 'done' || S.sheet.step === 'partial' ? closeImport() : ACT['import-later']();
    if (S.sheet?.type === 'nudge') return ACT['nudge-no']();
    S.sheet = null; S.after = null; render();
  },
  'confirm-yes': () => { const f = S.sheet.then; S.sheet = null; f(); render(); },
  undo: () => { S.toast?.undo?.(); S.toast = null; render(); },
  unit: a => { byId(S.detailId).unit = a; queueSync(); render(); },
  'cycle-unit': () => { const ev = byId(S.detailId); if (role(ev) === 'viewer') return; const i = UNITS.findIndex(u => u[0] === ev.unit); ev.unit = UNITS[(i + 1) % UNITS.length][0]; queueSync(); render(); },
  audio: () => {
    S.playing = !S.playing;
    if (S.playing && byId(S.detailId)?.audio?.type === 'spotify') toast('Playing a 30-second preview. Open in Spotify for the whole song.');
    render();
  },
  spotify: () => { const a = byId(S.detailId).audio; toast(`Opens “${a.title}” in Spotify`); render(); },
  'focus-memo': () => { const el = app.querySelector('[data-field="memo"]'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); },
  'add-memo': () => {
    const el = app.querySelector('[data-field="memo"]'), text = el.value.trim(); if (!text) return el.focus();
    const ev = byId(S.detailId), c = calc(ev), n = c.days + (S.settings.dayOne ? 1 : 0);
    ev.memos.push({ date: toISO(today()), text, tag: c.past && MILESTONES.includes(n) ? `Day ${fmt(n)}` : null });
    toast('Memo added'); queueSync(); render();
  },
  // editor
  cancel: () => { S.draft = null; back(); },
  save: () => {
    const d = S.draft;
    if (!d.title.trim()) { toast('Give it a name first'); S.edTab = 'details'; S.focus = '[data-field="title"]'; render(); return; }
    d.title = d.title.trim();
    const i = S.events.findIndex(e => e.id === d.id), prev = i < 0 ? null : S.events[i], g = gate(d, prev);
    if (g) return openSheet({ type: 'paywall', g });
    if (d.pinned && !prev?.pinned) { d.pinnedAt = Date.now(); S.pinIndex = 0; }
    if (prev) S.events[i] = d; else S.events.push(d);
    if (d.audio?.isNew) { delete d.audio.isNew; S.library.push({ id: d.audio.id, title: d.audio.title, dur: d.audio.dur, created: Date.now(), removed: false }); }
    pushRevision(prev, d); queueSync();
    S.draft = null; S.screen = S.stack.pop() || 'home';
    if (!prev) { S.stack.push(S.screen); S.screen = 'detail'; S.detailId = d.id; }
    S.anim = 'fade'; S.motion = true;
    toast(d.pinned && !prev?.pinned ? 'Saved and pinned to the top' : S.account && d.owner ? `Saved. ${d.owner.name} and the others see it now.` : 'Saved');
    render();
  },
  'ed-tab': a => { S.edTab = a; render(); },
  'prev-ctx': a => { S.prevCtx = a; S.motion = true; render(); },
  emoji: a => { S.draft.emoji = a; render(); },
  repeat: a => { S.draft.repeat = a; render(); },
  zone: a => { S.draft.zone = a === 'floating' ? null : a; render(); },
  cat: a => { S.draft.category = a; render(); },
  reminder: a => { S.draft.reminder = a; render(); },
  'draft-pin': () => { S.draft.pinned = !S.draft.pinned; if (S.draft.pinned) S.prevCtx = 'hero'; render(); },
  'draft-unit': a => { S.draft.unit = a; render(); },
  'bg-tab': a => { S.bgTab = a; render(); },
  color: a => { Object.assign(S.draft.look, { bg: { type: 'color', value: a }, dim: 0 }); render(); },
  grad: a => { Object.assign(S.draft.look, { bg: { type: 'gradient', id: a }, dim: 0 }); render(); },
  art: a => { Object.assign(S.draft.look, { bg: { type: 'art', id: a }, dim: 0 }); render(); },
  photo: a => {
    const live = PHOTOS.some(([id, l]) => id === +a && l);
    Object.assign(S.draft.look, { bg: { type: 'photo', src: pic(a), fx: 50, fy: 50, canAnimate: live, animated: live }, dim: Math.max(S.draft.look.dim, .25) });
    S.motion = live; render();
  },
  'toggle-live': () => { const bg = S.draft.look.bg; bg.animated = !bg.animated; S.motion = bg.animated; render(); },
  focal: (a, el, e) => {
    const r = el.getBoundingClientRect(), bg = S.draft.look.bg;
    bg.fx = Math.round((e.clientX - r.left) / r.width * 100); bg.fy = Math.round((e.clientY - r.top) / r.height * 100);
    el.querySelector('i').style.cssText = `left:${bg.fx}%;top:${bg.fy}%`; refreshPreview();
  },
  style: a => { S.draft.look.style = a; render(); },
  font: a => { S.draft.look.font = a; render(); },
  text: a => { S.draft.look.text = a; render(); },
  'sound-tab': a => { S.soundTab = a; render(); },
  track: a => { S.draft.audio = a ? { type: 'track', id: a } : null; render(); },
  'preview-track': a => { S.trackPreview = S.trackPreview === a ? null : a; render(); },
  'pick-file': () => { S.draft.audio = { type: 'file', id: 'lib' + Date.now().toString(36), title: 'Our song', dur: '7:12', keep: '0:48 – 6:18', isNew: true }; toast('Longer than 5½ minutes: drag the handles to pick the part to keep'); render(); },
  'add-spotify': () => {
    const v = app.querySelector('[data-field="spotify"]').value.trim(), m = v.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist)\/[A-Za-z0-9]+/);
    if (!m) { toast('That link isn’t a Spotify song, album or playlist'); return render(); }
    S.draft.audio = { type: 'spotify', kind: m[1][0].toUpperCase() + m[1].slice(1), title: { track: 'Song from Spotify', album: 'Album from Spotify', playlist: 'Road trip mix' }[m[1]], url: v };
    render();
  },
  flip: (a, el) => el.setAttribute('aria-checked', el.getAttribute('aria-checked') !== 'true'),
  // plans
  paywall: () => openSheet({ type: 'paywall', g: { title: 'Days That Matter Premium', text: 'More days and photos, Live Photos, the whole music catalog and your own songs.' } }),
  billing: a => { S.billing = a; render(); },
  upgrade: () => { S.plan = 'premium'; S.sheet = null; toast('Premium is active. Thanks!'); if (S.screen === 'editor' && S.draft) return ACT.save(); render(); },
  'paywall-alt': () => { S.sheet.g.alt.fix(S.draft); S.sheet = null; ACT.save(); },
  restore: () => { toast(S.plan === 'premium' ? 'Purchases restored. Premium is active.' : 'No purchases found for this Apple ID'); render(); },
  // account
  'signin-prompt': a => openSheet({ type: 'signin', reason: a }),
  signin: a => { if (a === 'email') { S.sheet = { type: 'signin', reason: S.sheet?.reason || 'settings', step: 'email' }; S.sheetFresh = !app.querySelector('.sheet'); return render(); } signIn(a); },
  'send-code': () => { const email = app.querySelector('[data-field="email"]')?.value.trim() || S.sheet.email; if (!/^\S+@\S+\.\S+$/.test(email || '')) { toast('Enter an email address'); return render(); } S.sheet = { ...S.sheet, step: 'code', email }; toast('Code sent'); render(); },
  'verify-code': () => { const v = app.querySelector('[data-field="code"]').value; if (!/^\d{6}$/.test(v)) { toast('Enter the 6-digit code'); return render(); } signIn('email'); },
  'local-start': () => { S.account = null; S.filter = 'all'; jump('home'); toast('Using this device only. Tap your name in Settings to add it.'); render(); },
  'edit-name': () => {
    S.dialog = 'name';
    S.dialogName = S.account ? (S.account.name || '') : (S.localName || '');
    S.focus = '.dialog input';
    render();
  },
  'dialog-save': () => {
    const val = (S.dialogName !== undefined ? S.dialogName : (app.querySelector('.dialog input')?.value ?? '')).trim();
    if (S.account) S.account.name = val;
    else S.localName = val;
    S.dialog = null;
    delete S.dialogName;
    render();
  },
  'dialog-cancel': () => {
    S.dialog = null;
    delete S.dialogName;
    render();
  },
  'import-open': () => openSheet({ type: 'import', step: 'ask' }),
  'import-go': () => { S.sheet = { ...S.sheet, step: 'confirm' }; render(); },
  'import-back': () => { S.sheet = { ...S.sheet, step: 'ask' }; render(); },
  'import-yes': () => startImportFlow(false),
  'import-retry': () => startImportFlow(false),
  'import-later': () => { toast('Kept on this device. You can import them from Settings.'); closeImport('skipped'); },
  'import-done': () => closeImport(),
  'export-events': () => {
    const fname = exportFileName();
    const count = (S.account ? S.accountEvents : S.localEvents).length;
    openSheet({ type: 'export-saved', fname, count });
  },
  'export-share': a => { toast(`Sharing ${a}…`); S.sheet = null; render(); },
  'file-import-open': () => openSheet({ type: 'file-import', step: 'pick' }),
  'file-import-chosen': () => { S.sheet = { type: 'file-import', step: 'confirm' }; render(); },
  'file-import-back': () => { S.sheet = { type: 'file-import', step: 'pick' }; render(); },
  'file-import-yes': () => startImportFlow(true),
  'file-import-retry': () => startImportFlow(true),
  'nudge-yes': () => { S.sheet = null; openSheet({ type: 'signin', reason: 'nudge' }); },
  'nudge-no': () => { S.nudgeNo++; S.sheet = null; toast(S.nudgeNo >= 2 ? 'OK. We won’t ask again. It’s in Settings if you change your mind.' : 'No problem.'); render(); },
  sync: () => { if (!S.account) return openSheet({ type: 'signin', reason: 'sync' }); S.pending = 0; S.lastSync = Date.now(); toast('Synced just now. Changes sync automatically after each edit.'); render(); },
  'sign-out': () => {
    const lc = localCount();
    const offline = S.unsyncedChanges === 'offline';
    const offlineMsg = offline ? `<div class="info inset" style="margin:8px 0 16px">${icon('info')}<span>Not everything has been sent yet. The rest will be sent the next time this device is online.</span></div>` : '';
    const onlineMsg = (!offline && S.pending) ? `<b>We’ll send your latest changes first.</b> ` : '';
    return openSheet({
      type: 'confirm',
      plain: true,
      title: 'Sign out and use this device only?',
      text: `${onlineMsg}You will go back to local mode, where you see only the days kept on this phone${lc.days ? ` (${plural(lc.days, 'day')})` : ''}. Days in your account, including any you imported, stay in your account and won’t show here. Other devices stay signed in.`,
      extra: offlineMsg,
      label: 'Sign out',
      then: () => {
        S.account = null; S.filter = 'all'; S.stack = []; S.screen = 'home'; S.anim = 'fade';
        toast('Signed out. You’re using this device only.');
      }
    });
  },
  'delete-account': () => openSheet({ type: 'confirm', title: 'Delete your account?', text: `This deletes your days, memos, links, invites and uploads, and removes you from days shared with you. ${S.plan === 'premium' ? '<b>Cancel your Premium subscription in the App Store first;</b> deleting the account does not stop billing.' : ''}`, label: 'Delete account',
    then: () => { S.account = null; S.accountEvents = []; S.plan = 'free'; toast('Account deleted. Days kept on this device are untouched.'); } }),
  // settings
  theme: a => { S.settings.theme = a; applyTheme(); render(); },
  accent: a => { S.settings.accent = a; applyTheme(); render(); },
  'set-flag': a => { S.settings[a] = !S.settings[a]; render(); },
  week: a => { S.settings.weekStart = a; render(); },
  wstyle: a => { S.settings.widgetStyle = a; render(); },
  toast: a => { toast(a); render(); },
};

let longFired = false, longTimer;
app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !app.contains(t)) return;
  if (t.tagName === 'A') e.preventDefault();
  if (longFired) { longFired = false; return; }
  ACT[t.dataset.act]?.(t.dataset.arg, t, e);
});
app.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape') {
    if (S.dialog) { S.dialog = null; delete S.dialogName; return render(); }
    if (S.sheet) { S.sheet = null; return render(); }
  }
  if (t.dataset?.field === 'dialog-name' && e.key === 'Enter') {
    e.preventDefault();
    return ACT['dialog-save']();
  }
  if (t.dataset?.field === 'memo' && e.key === 'Enter') return ACT['add-memo']();
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="button"][data-act], [role="radio"][data-act]')) { e.preventDefault(); t.click(); }
});
// Long-press (touch) or right-click opens the card actions.
app.addEventListener('pointerdown', e => {
  const c = e.target.closest('[data-long]'); if (!c) return;
  longFired = false;
  longTimer = setTimeout(() => { longFired = true; navigator.vibrate?.(10); openSheet({ type: 'actions', id: c.dataset.long }); }, 480);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => app.addEventListener(t, () => clearTimeout(longTimer)));
app.addEventListener('scroll', e => {
  clearTimeout(longTimer);
  const t = e.target;
  if (t.classList?.contains('pins')) {
    const i = pinFx(t);
    clearTimeout(pinTimer);
    pinTimer = setTimeout(() => {
      if (i === S.pinIndex) return;
      S.pinIndex = i;
      app.querySelectorAll('.dot').forEach((d, k) => d.setAttribute('aria-current', k === i));
      focusRow(true);
    }, 120);
  } else if (t.classList?.contains('home-list')) {
    // A scroll we started (carousel follow) must not collapse the carousel; it ends 150 ms after the list stops.
    if (autoScroll) { clearTimeout(autoTimer); autoTimer = setTimeout(() => { autoScroll = false; }, 150); return; }
    setCompact(t.closest('.home'), t);
  }
}, true);
app.addEventListener('contextmenu', e => {
  const c = e.target.closest('[data-long]'); if (!c) return;
  e.preventDefault(); openSheet({ type: 'actions', id: c.dataset.long });
});

app.addEventListener('input', e => {
  const f = e.target.dataset.field, val = e.target.value, d = S.draft;
  if (f === 'query') { S.query = val; S.focus = '.search input'; render(); }
  else if (f === 'title') { d.title = val; app.querySelector('#title-count').textContent = `${val.length}/100`; refreshPreview(); }
  else if (f === 'notes') { d.notes = val; app.querySelector('#notes-count').textContent = fmt(val.length); }
  else if (f === 'dim') { d.look.dim = val / 100; app.querySelector('#dim-out').textContent = `${val}%`; refreshPreview(); }
  else if (f === 'blur') { d.look.blur = +val; app.querySelector('#blur-out').textContent = val; refreshPreview(); }
  else if (f === 'color') { d.look.bg = { type: 'color', value: val.toUpperCase() }; refreshPreview(); }
  else if (f === 'link-label') S.share.linkLabel = val;
  else if (f === 'dialog-name') S.dialogName = val;
  else if (e.target.type === 'range') e.target.nextElementSibling.textContent = `${val}%`;
});
app.addEventListener('change', e => {
  const f = e.target.dataset.field, val = e.target.value, d = S.draft;
  if (f === 'date' && val) { d.date = val; render(); }
  else if (f === 'time') { d.time = val || null; render(); }
  else if (f === 'every') { d.every = Math.min(365, Math.max(2, +val || 10)); render(); }
  else if (f === 'color') render();
  else if (f === 'photo' && e.target.files[0]) { d.look.bg = { type: 'photo', src: URL.createObjectURL(e.target.files[0]), fx: 50, fy: 50 }; d.look.dim = Math.max(d.look.dim, .25); render(); }
});

// ---------- prototype panel ----------
const SCREENS = [
  ['onboarding', 'Welcome', 'First launch, step 1'],
  ['choice', 'Device or account', 'First launch, step 2 (new)'],
  ['home', 'Home', 'Swipe the pinned carousel; the list follows'],
  ['detail', 'Day', 'Tap the number to change units'],
  ['editor', 'Customize', 'Photo, Live Photo, style, font, music'],
  ['share', 'Share', 'Live links, invites, people, image'],
  ['archive', 'Archived', 'Hidden days; archiving unpins'],
  ['widgets', 'Widgets', 'Home and Lock Screen'],
  ['settings', 'Settings', 'Account, sync, plan, appearance'],
];
// Name variants for the greeting. They change the name of whichever mode is active (local name, or the account's display name).
const NAMES = { default: null, long: 'Alexandria Montgomery-Featherstonehaugh', emoji: 'Mia 🌸', none: '' };
const nameKey = () => { const n = S.account ? S.account.name : S.localName; return n === NAMES.long ? 'long' : n === NAMES.emoji ? 'emoji' : n === '' ? 'none' : 'default'; };
function renderPanel() {
  const cur = S.sheet?.type === 'share' ? 'share' : S.screen;
  const seg = (label, pairs, cur2, key, wide = '') => `<div class="pctl ${wide}"><span>${label}</span><div class="seg sm" role="group" aria-label="${label}">${pairs.map(([k, n]) => `<button data-p${key}="${k}" ${pressed(cur2, k)}>${n}</button>`).join('')}</div></div>`;
  panel.innerHTML = `<div class="brand"><svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--accent)"/><circle cx="20" cy="21" r="6" fill="var(--on-accent)"/><path d="M10 27.5h20" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round"/><path d="M20 9.5v3M11.5 13l2 2M28.5 13l-2 2" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round"/></svg>
    <div><b>Days That Matter</b><small>Design v2 · interactive prototype</small></div></div>
    <p class="panel-text">Quiet, light chrome. Each day card brings its own photo, color or art. Pinned days lead Home in a carousel.</p>
    <nav class="nav" aria-label="Screens">${SCREENS.map(([k, n, hint]) => `<button data-pact="${k}" aria-current="${cur === k}">${n}<small>${hint}</small></button>`).join('')}</nav>
    <div class="pctls">
      ${seg('Theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], S.settings.theme, 'theme')}
      ${seg('Account', [['local', 'Local'], ['signed', 'Signed in']], S.account ? 'signed' : 'local', 'acct')}
      ${seg('Plan', [['free', 'Free'], ['premium', 'Premium']], S.plan, 'plan')}
      ${seg('Limits config', [['default', 'Default'], ['no-spotify', 'Spotify limit removed']], S.limitsConfig, 'limits', 'stack')}
      ${seg('Memo badge', [['top-left', 'Left'], ['top-right', 'Right']], S.config.memoBadge, 'badge')}
      ${seg('Days on device', [['none', 'None'], ['some', 'Some']], S.localEvents.length ? 'some' : 'none', 'days')}
      ${seg('Import choice', [['none', 'Not yet'], ['imported', 'Imported'], ['skipped', 'Skipped']], S.importChoice, 'import', 'stack')}
      ${seg('Import result', [['ok', 'Success'], ['fail', 'Failed'], ['cannot', "Can't import"], ['new', 'File too new']], S.importResult, 'result', 'stack')}
      ${seg('Widgets', [['normal', 'Normal'], ['signed-out', 'Signed out'], ['not-imported', 'Signed in, not imported']], S.widgetMode, 'wmode', 'stack')}
      ${seg('Unsynced changes', [['none', 'None'], ['offline', 'Some, offline']], S.unsyncedChanges, 'unsynced', 'stack')}
      ${seg('Name', [['default', 'Short'], ['long', 'Long'], ['emoji', 'Emoji'], ['none', 'None']], nameKey(), 'name', 'stack')}
      ${seg('Time of day', [['now', 'Now'], ['9', 'Morning'], ['14', 'Afternoon'], ['19', 'Evening'], ['1', 'Late']], S.clockHour === null ? 'now' : String(S.clockHour), 'hour', 'stack')}
      <div class="pctl"><span>Heavy-use nudge</span><button class="btn btn-ghost sm" data-pnudge="1">Show</button></div>
    </div>
    <div class="panel-foot"><a href="README.md">Design notes &amp; gaps</a><button data-pact="reset">Reset demo</button></div>`;
  panel.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.pact;
  if (b.dataset.ptheme) { S.settings.theme = b.dataset.ptheme; applyTheme(); return render(); }
  if (b.dataset.plimits) { S.limitsConfig = b.dataset.plimits; return render(); }
  if (b.dataset.pwmode) { S.widgetMode = b.dataset.pwmode; return render(); }
  if (b.dataset.punsynced) { S.unsyncedChanges = b.dataset.punsynced; return render(); }
  if (b.dataset.pdays) { setLocalDays(b.dataset.pdays === 'some'); S.sheet = null; return render(); }
  if (b.dataset.presult) {
    S.importResult = b.dataset.presult;
    if (S.sheet && (S.sheet.type === 'import' || S.sheet.type === 'file-import')) {
      if (['done', 'failed', 'cannot', 'too-new'].includes(S.sheet.step)) {
        const isFile = S.sheet.type === 'file-import';
        const step = S.importResult === 'ok' ? 'done' : S.importResult === 'fail' ? 'failed' : S.importResult === 'cannot' ? 'cannot' : (isFile ? 'too-new' : 'cannot');
        S.sheet.step = step;
      }
    }
    return render();
  }
  if (b.dataset.pname) { const v = b.dataset.pname === 'default' ? (S.account ? ACCOUNT.name : 'Sam') : NAMES[b.dataset.pname]; if (S.account) S.account.name = v; else S.localName = v; return render(); }
  if (b.dataset.phour) { S.clockHour = b.dataset.phour === 'now' ? null : +b.dataset.phour; return render(); }
  if (b.dataset.pnudge) { S.account = null; if (S.screen !== 'home') { S.stack = []; S.screen = 'home'; } return openSheet({ type: 'nudge' }); }
  if (b.dataset.pimport) {
    const v = b.dataset.pimport;
    ensureSigned();
    if (v !== 'skipped' && !S.localEvents.length) setLocalDays(true);
    S.afterImport = null;
    if (v === 'none') { S.importChoice = 'none'; return openSheet({ type: 'import', step: 'ask' }); }
    if (v === 'imported') {
      S.sheet = null;
      if (S.localEvents.length) {
        S.accountEvents.push(...S.localEvents.map(e => ({ ...structuredClone(e), imported: true })));
        S.localEvents = [];
      }
      S.importChoice = 'imported';
      return render();
    }
    S.importChoice = 'skipped'; S.sheet = null; return render();
  }
  if (b.dataset.pacct) { S.account = b.dataset.pacct === 'signed' ? { ...ACCOUNT } : null; S.filter = 'all'; if (S.screen === 'detail' && !visible().includes(byId(S.detailId))) S.screen = 'home'; return render(); }
  if (b.dataset.pplan) { S.plan = b.dataset.pplan; return render(); }
  if (b.dataset.pbadge) { S.config.memoBadge = b.dataset.pbadge; return render(); } // simulates a remote config change
  if (k === 'reset') {
    if (importTimer) { clearTimeout(importTimer); importTimer = null; }
    Object.assign(S, {
      accountEvents: seed(), localEvents: seedLocal(), history: seedHistory(), library: seedLibrary(),
      account: { ...ACCOUNT }, localName: 'Sam', importChoice: 'skipped', importResult: 'ok',
      limitsConfig: 'default', widgetMode: 'normal', unsyncedChanges: 'none',
      afterImport: null, nudgeNo: 0, clockHour: null, plan: 'free', pending: 0,
      sheet: null, dialog: null, filter: 'all', query: '', searching: false
    });
    delete S.dialogName;
    S.settings.dayOne = false;
    return jump('home');
  }
  if (k === 'editor') { S.stack = []; S.screen = 'home'; return openEditor(byId(S.detailId) && visible().includes(byId(S.detailId)) ? S.detailId : pins()[0]?.id, 'background'); }
  if (k === 'detail' || k === 'share') {
    if (!byId(S.detailId) || !visible().includes(byId(S.detailId))) S.detailId = (pins()[0] || visible()[0]).id;
    jump('detail'); if (k === 'share') ACT.share(); return;
  }
  jump(k);
});

// ---------- boot ----------
function fit() { document.getElementById('device').style.setProperty('--fit', Math.min(1, (innerHeight - 40) / 876).toFixed(3)); }
addEventListener('resize', fit);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
setInterval(() => {
  app.querySelectorAll('[data-tick]').forEach(el => {
    const ev = S.screen === 'editor' && S.draft?.id === el.dataset.tick ? S.draft : byId(el.dataset.tick);
    if (ev) el.textContent = tickText(ev);
  });
  const t = app.querySelector('.sb-time');
  if (t) t.textContent = clock(new Date()).replace(/\s?[AP]M/, '');
}, 1000);
fit(); applyTheme(); render();
