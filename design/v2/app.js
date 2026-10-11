'use strict';
/* Days That Matter · design v2 prototype. Plain JS, no build step.
   One state object, one render(). Date math here is for the demo only;
   the real engine is the Kotlin one in docs/features/events/SPEC.md. */

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

// Month arithmetic clamps to the last day (Jan 31 + 1 month = Feb 28), always from the anchor.
function addMonths(d, n) {
  const t = d.getMonth() + n, y = d.getFullYear() + Math.floor(t / 12), m = ((t % 12) + 12) % 12;
  return new Date(y, m, Math.min(d.getDate(), daysIn(y, m)));
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

function calc(ev, now = new Date()) {
  const t0 = sod(now), target = nextOccurrence(ev, t0), days = diffDays(t0, target);
  const at = new Date(target);
  if (ev.time) { const [h, m] = ev.time.split(':'); at.setHours(+h, +m); }
  return { target, at, days: Math.abs(days), future: days > 0, past: days < 0, today: days === 0, ms: at - now };
}

function ymdBetween(a, b) {
  let k = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (addMonths(a, k) > b) k--;
  return { y: Math.floor(k / 12), m: k % 12, d: diffDays(addMonths(a, k), b) };
}

function workdays(a, b) {
  let n = 0;
  for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (d.getDay() % 6) n++;
  return n;
}

// ponytail: smoke checks for the demo math only; the shipping engine has its own tests.
console.assert(toISO(addMonths(new Date(2025, 0, 31), 1)) === '2025-02-28', 'month clamp');
console.assert(JSON.stringify(ymdBetween(new Date(2025, 0, 31), new Date(2025, 2, 1))) === '{"y":0,"m":1,"d":1}', 'ymd borrow');
console.assert(toISO(nextOccurrence({ date: '2020-02-29', repeat: 'yearly' }, new Date(2026, 2, 1))) === '2027-02-28', 'leap yearly');
console.assert(workdays(new Date(2026, 9, 9), new Date(2026, 9, 16)) === 5, 'workdays');

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

// ---------- catalog ----------
const CATS = [['birthday', 'Birthdays', '🎂'], ['anniversary', 'Anniversaries', '💞'], ['travel', 'Travel', '✈️'], ['holiday', 'Holidays', '🧧'], ['work', 'Work', '💼'], ['life', 'Life', '🌱']];
const REPEATS = [['none', 'Never'], ['yearly', 'Every year'], ['monthly', 'Every month'], ['weekly', 'Every week'], ['custom', 'Every N days']];
const REMINDERS = [['none', 'None'], ['day', 'On the day'], ['1d', '1 day before'], ['1w', '1 week before']];
const UNITS = [['days', 'Days'], ['ymd', 'Y·M·D'], ['weeks', 'Weeks'], ['hours', 'Hours'], ['workdays', 'Workdays']];
const SORTS = [['smart', 'Closest first'], ['far', 'Furthest first'], ['az', 'A to Z'], ['new', 'Recently added']];
const EMOJIS = ['✨', '🎂', '💞', '🏔️', '✈️', '🧧', '🎓', '💼', '🚀', '🐶', '🌱', '🍃', '🏃', '🎄', '🏠', '👶', '💍', '📚', '💸', '🎉'];
const TRACKS = [['Calm Lo-Fi', '2:41 · soft keys'], ['Gentle Acoustic', '3:05 · guitar'], ['Celebration Chimes', '0:48 · bright'], ['Nature Rain', '5:00 · ambient']];
const ACCENTS = [['jade', '#0E8F63'], ['sky', '#2A6FD6'], ['coral', '#C9472C'], ['plum', '#7547C2'], ['ink', '#1B2420']];
const MILESTONES = [100, 200, 300, 365, 500, 520, 730, 1000, 1314, 1500, 2000, 2500, 3000, 3650, 5000, 10000];

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
const PHOTOS = [1015, 129, 1025, 17, 106, 152, 189, 16, 54, 1043, 56];
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
// Auto text color: whichever of white / ink has more contrast on the dimmed base color.
// 0.2 is roughly where both give the same ratio.
const effLum = look => lum(baseColor(look.bg)) * (1 - look.dim);
const tone = look => look.text !== 'auto' ? look.text : effLum(look) > .2 ? 'dark' : 'light';
function contrastInfo(look) {
  if (look.bg.type === 'photo') return { ok: true, text: 'Photo: scrim plus soft text shadow. Raise Darken for busy photos.' };
  const r = ratio(effLum(look), tone(look) === 'dark' ? lum('#111714') : 1);
  return { ok: r >= 4.5, text: `${r.toFixed(1)} : 1 contrast · ${r >= 4.5 ? 'passes AA' : r >= 3 ? 'large text only' : 'too low, try Auto'}` };
}
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

// ---------- seed ----------
function seed() {
  const t = today(), rel = n => toISO(addDays(t, n));
  const yearsAgo = (n, y) => { const d = addDays(t, n); return toISO(new Date(d.getFullYear() - y, d.getMonth(), d.getDate())); };
  const look = (bg, o = {}) => ({ bg, dim: bg.type === 'photo' ? .25 : 0, blur: 0, style: 'glass', font: 'sans', text: 'auto', ...o });
  return [
    { id: 'norway', title: 'Norway trip', emoji: '🏔️', date: rel(38), time: '09:30', category: 'travel', pinned: true, created: rel(-62), reminder: '1w', audio: 'Calm Lo-Fi',
      look: look({ type: 'photo', src: pic(1015), fx: 50, fy: 62 }),
      memos: [{ date: rel(-20), author: 'You', text: 'Booked the night train from Oslo to Bergen.' }, { date: rel(-3), author: 'Lin', text: 'Rain jackets. Both of us. No arguments this time.' }] },
    { id: 'mia', title: "Mia's birthday", emoji: '🎂', date: yearsAgo(23, 7), repeat: 'yearly', category: 'birthday', look: look({ type: 'color', value: '#FADDCB' }, { style: 'clean', font: 'rounded' }) },
    { id: 'together', title: 'Together', emoji: '💞', date: '2021-05-20', category: 'anniversary', audio: 'Gentle Acoustic',
      look: look({ type: 'photo', src: pic(129), fx: 50, fy: 55 }, { font: 'serif', dim: .22 }),
      memos: [{ date: '2021-05-20', author: 'You', text: 'First walk along the river. It rained the whole time.', tag: 'Day 1' },
        { date: '2024-02-13', author: 'Lin', text: 'Day 1,000. Dumplings at the place we found on day 3.', tag: 'Day 1,000' },
        { date: rel(-40), author: 'You', text: 'Planted the lemon tree on the balcony.' }] },
    { id: 'payday', title: 'Payday', emoji: '💸', date: toISO(new Date(2025, 0, t.getDate())), repeat: 'monthly', category: 'work', look: look({ type: 'art', id: 'confetti' }, { style: 'clean' }) },
    { id: 'lny', title: 'Lunar New Year', emoji: '🧧', date: '2027-02-06', category: 'holiday', look: look({ type: 'gradient', id: 'citrus' }, { style: 'poster', font: 'condensed' }) },
    { id: 'launch', title: 'App launch', emoji: '🚀', date: rel(49), category: 'work', unit: 'workdays', look: look({ type: 'color', value: '#2D6CDF' }, { style: 'outline', font: 'mono' }) },
    { id: 'mochi', title: 'Mochi came home', emoji: '🐶', date: '2024-03-09', category: 'life', look: look({ type: 'photo', src: pic(1025), fx: 50, fy: 45 }, { font: 'rounded' }),
      memos: [{ date: '2024-03-09', author: 'You', text: 'Slept the whole ride home.', tag: 'Day 1' }] },
    { id: 'sugar', title: 'No added sugar', emoji: '🍃', date: rel(-73), category: 'life', look: look({ type: 'gradient', id: 'lagoon' }) },
    { id: 'marathon', title: 'Spring marathon', emoji: '🏃', date: rel(158), category: 'life', unit: 'weeks', look: look({ type: 'art', id: 'hills' }, { style: 'poster', font: 'condensed' }) },
  ].map((e, i) => ({ repeat: 'none', every: 10, time: null, pinned: false, unit: 'days', created: rel(-30 - i), reminder: 'day', audio: null, memos: [], ...e }));
}

// ---------- state ----------
const S = {
  screen: 'home', stack: [], anim: '', events: seed(),
  filter: 'all', layout: 'list', sort: 'smart', query: '', searching: false,
  detailId: 'norway', playing: false,
  draft: null, edTab: 'details', bgTab: 'photo', prevCtx: 'hero', trackPreview: null,
  share: { format: 'story', watermark: true, expiry: 'never' },
  sheet: null, toast: null,
  settings: { theme: 'system', accent: 'jade', dayOne: false, weekStart: 'mon', showHero: true, widgetStyle: 'match', notify: true },
};
const byId = id => S.events.find(e => e.id === id);
const pinned = () => S.events.find(e => e.pinned);
const scrollMem = {};

// ---------- values ----------
function occurrence(ev, c) {
  if (ev.repeat === 'yearly') {
    const n = c.target.getFullYear() - parse(ev.date).getFullYear();
    if (n > 0) return ev.category === 'birthday' ? `turns ${n}` : `${ordinal(n)} anniversary`;
  }
  return { monthly: 'Monthly', weekly: 'Weekly', custom: `Every ${ev.every} days` }[ev.repeat] || '';
}

function valueFor(ev, unit, c) {
  if (c.today) return { num: 'Today', u: ev.repeat === 'yearly' ? occurrence(ev, c) : 'it’s the day', today: true };
  const dir = c.future ? 'left' : 'since';
  const [a, b] = c.future ? [today(), c.target] : [c.target, today()];
  switch (unit) {
    case 'ymd': {
      const { y, m, d } = ymdBetween(a, b);
      const parts = [[y, 'y'], [m, 'm'], [d, 'd']].filter(([n], i) => n || i === 2 || (i === 1 && y));
      return { num: parts.map(([n, s]) => `${n}<small>${s}</small>`).join(''), u: c.future ? 'to go' : 'since', long: true };
    }
    case 'weeks': return { num: `${Math.floor(c.days / 7)}<small>w</small>${c.days % 7}<small>d</small>`, u: c.future ? 'to go' : 'since', long: true };
    case 'hours': return { num: fmt(Math.floor(Math.abs(c.ms) / 36e5)), u: `hours ${dir}` };
    case 'workdays': return { num: fmt(workdays(a, b)), u: `workdays ${dir}` };
    default:
      if (!c.future && S.settings.dayOne) return { pre: 'Day', num: fmt(c.days + 1), u: 'and counting' };
      return { num: fmt(c.days), u: `${c.days === 1 ? 'day' : 'days'} ${dir}` };
  }
}

function meta(ev, c) {
  if (c.past) return `Since ${fmtDate(c.target, 'year')}`;
  const occ = occurrence(ev, c);
  return [c.today ? 'Today' : fmtDate(c.target), occ].filter(Boolean).join(' · ');
}
const metaLong = (ev, c) => `${c.past ? 'Since ' : ''}${fmtDate(c.target, 'long')}${ev.time ? ' · ' + fmtTime(ev.time) : ''}`;

function tickText(ev) {
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
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  memo: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M9 9h6M9 12.5h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>', upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 20h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  palette: '<path d="M12 3a9 9 0 000 18c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.8-2.4H18a3 3 0 003-3c0-5.5-4-10.5-9-10.5z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/>',
  bell: '<path d="M6 16v-5a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>', calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  repeat: '<path d="M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3"/>',
  widgets: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="16" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.8 4.8 0 01-1 9.5z"/>', globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 2.5 14.3 0 17M12 3.5c-2.5 2.7-2.5 14.3 0 17"/>',
  archive: '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/>', mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4.5 7l7.5 6 7.5-6"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>', pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
  sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/>', duplicate: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M4 16V7a3 3 0 013-3h9"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>', send: '<path d="M5 12h13M13 6l6 6-6 6"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7M3.5 12.5h17"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- card ----------
function layers(L) {
  const blur = L.blur ? `filter:blur(${L.blur}px);inset:-${L.blur * 2}px;` : '';
  return `<div class="card-bg" style="${esc(`background:${bgCSS(L.bg)};${blur}`)}"></div>`
    + (L.dim ? `<div class="card-scrim" style="opacity:${L.dim}"></div>` : '')
    + (L.bg.type === 'photo' ? '<div class="card-legible"></div>' : '')
    + '<div class="card-grain"></div>';
}
const count = v => `${v.pre ? `<span class="pre">${v.pre}</span>` : ''}<span class="num${v.long ? ' long' : ''}">${v.num}</span>`;
const cardClass = (ev, ctx, style = ev.look.style) => `card ctx-${ctx} st-${style} tone-${tone(ev.look)} font-${ev.look.font}`;
const cardVars = L => esc(`--swatch:${bgCSS(L.bg)};--edge:${edgeColor(L.bg)}`);
const title = ev => esc(ev.title || 'Untitled day');

const CTX = {
  row: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div class="txt"><div class="t">${title(ev)}</div><div class="m">${ev.pinned ? icon('pin', 'mini') : ''}${esc(meta(ev, c))}</div></div><div class="cnt">${count(v)}<div class="u">${v.u}</div></div>`,
  tile: (ev, c, v) => `<div class="top"><span class="emo">${ev.emoji}</span>${ev.pinned ? icon('pin', 'mini') : ''}</div><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(ev)}</div><div class="m">${esc(meta(ev, c))}</div></div>`,
  hero: (ev, c, v) => `<div class="top"><span class="glass-pill">${ev.pinned ? `${icon('pin', 'mini')}Pinned` : esc(catOf(ev)[1])}</span><span class="emo">${ev.emoji}</span></div>
    <div><div class="t">${title(ev)}</div><div class="m">${esc(metaLong(ev, c))}</div>
    <div class="row"><div class="h-count">${count(v)}<span class="u">${v.u}</span></div><span class="glass-pill tick" data-tick="${ev.id}">${tickText(ev)}</span></div></div>`,
  mini: (ev, c, v) => `<span class="emo">${ev.emoji}</span>${count(v)}`,
  ws: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(ev)}</div></div>`,
  story: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div class="t">${title(ev)}</div>${count(v)}<div class="u">${v.u}</div><div class="m">${esc(fmtDate(c.target, 'year'))}</div>${S.share.watermark ? '<div class="mark">Days That Matter</div>' : ''}`,
  square: (ev, c, v) => `<span class="emo">${ev.emoji}</span><div>${count(v)}<div class="u">${v.u}</div><div class="t" style="margin-top:10px">${title(ev)}</div><div class="m">${esc(fmtDate(c.target, 'year'))}</div></div>${S.share.watermark ? '<div class="mark">Days That Matter</div>' : ''}`,
};

function card(ev, ctx, attrs = '') {
  const c = calc(ev), v = valueFor(ev, ev.unit, c);
  const style = ['story', 'square'].includes(ctx) && ev.look.style === 'outline' ? 'clean' : ev.look.style;
  return `<article class="${cardClass(ev, ctx, style)}" style="${cardVars(ev.look)}" ${attrs}>${layers(ev.look)}<div class="card-body">${CTX[ctx](ev, c, v)}</div></article>`;
}
function openAttrs(ev) {
  const v = valueFor(ev, ev.unit, calc(ev));
  return `data-act="open" data-arg="${ev.id}" data-long="${ev.id}" role="button" tabindex="0" aria-label="${esc(`${ev.title}, ${strip(v.pre || '')} ${strip(v.num)} ${strip(v.u)}`)}"`;
}
const catOf = ev => CATS.find(c => c[0] === ev.category) || ['life', 'Life', '🌱'];

// ---------- views ----------
function statusbar() {
  const ev = S.screen === 'detail' && byId(S.detailId);
  const light = (ev && tone(ev.look) === 'light') || isDark();
  const time = new Date().toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '');
  const veil = !['detail', 'onboarding'].includes(S.screen) ? 'veil' : '';
  return `<div class="statusbar ${light ? 'on-dark' : ''} ${veil}" aria-hidden="true"><span class="sb-time">${time}</span><span class="sb-icons">
    <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 16 12"><path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.3-1.4A10.3 10.3 0 008 .4 10.3 10.3 0 00.7 3.4L2 4.8a8.4 8.4 0 016-2.4zm0 4c1.2 0 2.3.5 3.2 1.2l1.3-1.4A6.6 6.6 0 008 4.4 6.6 6.6 0 003.5 6.2l1.3 1.4C5.7 6.9 6.8 6.4 8 6.4zm0 4.2 1.9-2A2.8 2.8 0 008 8a2.8 2.8 0 00-1.9.6z"/></svg>
    <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="24.5" y="4" width="1.8" height="4" rx=".9" opacity=".4"/></svg>
  </span></div><div class="island"></div>`;
}

function sortRows(rows, kind) {
  const by = {
    smart: (a, b) => a.c.days - b.c.days,
    far: (a, b) => b.c.days - a.c.days,
    az: (a, b) => a.e.title.localeCompare(b.e.title),
    new: (a, b) => b.e.created.localeCompare(a.e.created),
  }[S.sort];
  return rows.sort(by);
}

function homeView() {
  const q = S.query.trim().toLowerCase(), pin = pinned();
  const hero = pin && S.settings.showHero && !q && S.filter === 'all' ? pin : null;
  let rows = S.events.filter(e => e !== hero).map(e => ({ e, c: calc(e) }));
  if (q) rows = rows.filter(r => r.e.title.toLowerCase().includes(q));
  if (CATS.some(c => c[0] === S.filter)) rows = rows.filter(r => r.e.category === S.filter);
  const up = sortRows(rows.filter(r => !r.c.past)), since = sortRows(rows.filter(r => r.c.past));
  const sections = [S.filter !== 'since' && ['Upcoming', up], S.filter !== 'upcoming' && ['Since', since]].filter(s => s && s[1].length);
  const filters = [['all', 'All'], ['upcoming', 'Upcoming'], ['since', 'Since'], ...CATS.map(([k, n]) => [k, n])];
  const tools = `<div class="tools"><button data-act="layout" aria-label="${S.layout === 'list' ? 'Show as grid' : 'Show as list'}">${icon(S.layout === 'list' ? 'grid' : 'list')}</button><button data-act="sort-menu" aria-label="Sort">${icon('sort')}</button></div>`;
  const ctx = S.layout === 'grid' ? 'tile' : 'row';
  return `<section class="view home" data-key="home">
    <header class="home-head">
      <div><div class="kicker">${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 class="h1">Your days</h1></div>
      <div class="head-btns"><button class="icon-btn" data-act="search" aria-label="Search">${icon('search')}</button><button class="icon-btn" data-act="go" data-arg="settings" aria-label="Settings and account">${icon('user')}</button></div>
    </header>
    ${S.searching ? `<div class="search">${icon('search')}<input data-field="query" placeholder="Search your days" value="${esc(S.query)}" aria-label="Search your days"><button data-act="search" aria-label="Close search">${icon('close')}</button></div>` : ''}
    ${hero ? `<div class="hero-wrap">${card(hero, 'hero', openAttrs(hero))}</div>` : ''}
    <div class="chips" role="group" aria-label="Filter">${filters.map(([k, n]) => `<button class="chip" data-act="filter" data-arg="${k}" aria-pressed="${S.filter === k}">${n}</button>`).join('')}</div>
    ${sections.length ? sections.map(([name, rs], i) => `<div class="sec-head"><h2>${name}<span>${rs.length}</span></h2>${i === 0 ? tools : ''}</div>
      <div class="${S.layout}">${rs.map(r => card(r.e, ctx, openAttrs(r.e))).join('')}</div>`).join('')
      : `<div class="sec-head"><span></span>${tools}</div><div class="empty"><div class="big">🌤️</div><b>${q ? 'No matches' : 'Nothing here yet'}</b>${q ? 'Try another word.' : 'Add a day and give it a photo or a color.'}</div>`}
    <div style="height:130px"></div>
  </section>
  <div class="bottom-fade"></div>
  <button class="fab" data-act="new">${icon('plus')}New day</button>`;
}

function milestonesBlock(ev, c) {
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

function detailView() {
  const ev = byId(S.detailId);
  if (!ev) { S.screen = 'home'; return homeView(); }
  const c = calc(ev), v = valueFor(ev, ev.unit, c), [, catName, catEmoji] = catOf(ev);
  const rep = ev.repeat === 'none' ? '' : ` · ${ev.repeat === 'custom' ? `Every ${ev.every} days` : REPEATS.find(r => r[0] === ev.repeat)[1]}`;
  const style = ev.look.style === 'outline' ? 'clean' : ev.look.style;
  const memos = ev.memos.map((m, i) => `<div class="memo"><span class="av ${m.author === 'You' ? '' : 'alt'}">${m.author[0]}</span><div>
      <div class="memo-meta"><b>${esc(m.author)}</b><span>${fmtDate(parse(m.date), 'year')}</span>${m.tag ? `<span class="tag">${esc(m.tag)}</span>` : ''}</div><p>${esc(m.text)}</p></div></div>`).join('');
  return `<section class="view detail" data-key="detail">
    <article class="${cardClass(ev, 'detail', style)}" style="${cardVars(ev.look)}">${layers(ev.look)}<div class="card-body">
      <header class="d-bar"><button class="gbtn" data-act="back" aria-label="Back">${icon('back')}</button><span class="sp"></span>
        ${ev.audio ? `<button class="gbtn" data-act="audio" aria-label="${S.playing ? 'Pause' : 'Play'} ${esc(ev.audio)}" aria-pressed="${S.playing}"><span class="disc ${S.playing ? 'playing' : ''}"></span></button>` : ''}
        <button class="gbtn" data-act="share" aria-label="Share">${icon('share')}</button>
        <button class="gbtn" data-act="more" data-arg="${ev.id}" aria-label="More actions">${icon('more')}</button></header>
      <div class="d-main">
        <span class="glass-pill">${catEmoji} ${catName}${rep}</span>
        <span class="emo">${ev.emoji}</span>
        <h1 class="t">${title(ev)}</h1>
        <div class="m">${esc(metaLong(ev, c))}${occurrence(ev, c) && !c.today ? ` · ${esc(occurrence(ev, c))}` : ''}</div>
        <button class="d-count" data-act="cycle-unit" aria-label="Switch unit">${count(v)}<span class="u">${v.u}</span></button>
        <div class="tick" data-tick="${ev.id}">${tickText(ev)}</div>
        <div class="seg seg-glass units" role="group" aria-label="Unit">${UNITS.map(([k, n]) => `<button data-act="unit" data-arg="${k}" aria-pressed="${ev.unit === k}">${n}</button>`).join('')}</div>
      </div></div></article>
    <div class="d-panel"><div class="grabber"></div>
      <div class="actions">
        <button class="act" data-act="edit" data-arg="${ev.id}">${icon('edit')}Customize</button>
        <button class="act" data-act="share">${icon('share')}Share</button>
        <button class="act" data-act="${ev.audio ? 'audio' : 'edit-sound'}" aria-pressed="${S.playing && !!ev.audio}">${S.playing && ev.audio ? '<span class="eq"><i></i><i></i><i></i></span>' : icon('music')}${ev.audio ? 'Music' : 'Add music'}</button>
        <button class="act" data-act="focus-memo">${icon('memo')}Memo</button>
      </div>
      ${milestonesBlock(ev, c)}
      <div class="block" id="memos"><h3>Memos<span>${ev.memos.length || ''}</span></h3>${memos}
        <div class="compose"><input data-field="memo" placeholder="Write a memory or a note" aria-label="New memo"><button class="send" data-act="add-memo" aria-label="Add memo">${icon('send')}</button></div></div>
      <div class="block"><h3>Details</h3>
        <div class="kv"><span>Date</span><span>${fmtDate(parse(ev.date), 'long')}</span></div>
        <div class="kv"><span>Time</span><span>${ev.time ? fmtTime(ev.time) : 'All day'}</span></div>
        <div class="kv"><span>Repeats</span><span>${ev.repeat === 'custom' ? `Every ${ev.every} days` : REPEATS.find(r => r[0] === ev.repeat)[1]}</span></div>
        <div class="kv"><span>Reminder</span><span>${REMINDERS.find(r => r[0] === ev.reminder)[1]}</span></div>
        <div class="kv"><span>Pinned</span><span>${ev.pinned ? 'Yes, top of Home' : 'No'}</span></div></div>
    </div>
  </section>`;
}

function editorView() {
  const d = S.draft, isNew = !byId(d.id);
  const tabs = [['details', 'Details'], ['background', 'Background'], ['style', 'Style'], ['sound', 'Sound']];
  return `<section class="view editor" data-key="editor">
    <div class="ed-top">
      <div class="ed-bar"><button class="txt-btn" data-act="cancel">Cancel</button><span class="ttl">${isNew ? 'New day' : 'Customize'}</span><button class="save-btn" data-act="save">Save</button></div>
      <div class="ed-preview" id="preview">${previewHTML()}</div>
      <div class="prev-switch"><div class="seg sm" role="group" aria-label="Preview as">${[['hero', 'Pinned'], ['row', 'List'], ['ws', 'Widget']].map(([k, n]) => `<button data-act="prev-ctx" data-arg="${k}" aria-pressed="${S.prevCtx === k}">${n}</button>`).join('')}</div></div>
      <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-act="ed-tab" data-arg="${k}" aria-selected="${S.edTab === k}">${n}</button>`).join('')}</div>
    </div>
    <div class="ed-body">${EDITOR_TABS[S.edTab](d)}</div>
  </section>`;
}
const previewHTML = () => card(S.draft, S.prevCtx);
const pressed = (a, b) => `aria-pressed="${a === b}"`;

const EDITOR_TABS = {
  details: d => {
    const other = S.events.find(e => e.pinned && e.id !== d.id);
    return `<div><div class="flabel"><span>Title</span><span class="opt" id="title-count">${d.title.length}/40</span></div><input class="input title" data-field="title" maxlength="40" value="${esc(d.title)}" placeholder="What are you counting?"></div>
    <div><div class="flabel">Emoji</div><div class="emojis">${EMOJIS.map(e => `<button class="emoji-opt" data-act="emoji" data-arg="${e}" ${pressed(d.emoji, e)} aria-label="Emoji ${e}">${e}</button>`).join('')}</div></div>
    <div class="row2"><div><div class="flabel">Date</div><input class="input" type="date" data-field="date" value="${d.date}"></div>
      <div><div class="flabel"><span>Time</span><span class="opt">optional</span></div><input class="input" type="time" data-field="time" value="${d.time || ''}"></div></div>
    <div><div class="flabel">Repeat</div><div class="chips-wrap">${REPEATS.map(([k, n]) => `<button class="chip" data-act="repeat" data-arg="${k}" ${pressed(d.repeat, k)}>${n}</button>`).join('')}</div>
      ${d.repeat === 'custom' ? `<label class="inline-num">Every <input class="input" type="number" min="2" max="365" data-field="every" value="${d.every}"> days</label>` : ''}</div>
    <div><div class="flabel">Category</div><div class="chips-wrap">${CATS.map(([k, n, e]) => `<button class="chip" data-act="cat" data-arg="${k}" ${pressed(d.category, k)}>${e} ${n}</button>`).join('')}</div></div>
    <div class="switch-row"><div><b>Pin to top</b><small>${d.pinned && other ? `Replaces “${esc(other.title)}”. Only one day is pinned.` : other ? `“${esc(other.title)}” is pinned now` : 'Shows as the big card on Home'}</small></div>
      <button class="switch" role="switch" aria-label="Pin to top" aria-checked="${d.pinned}" data-act="draft-pin"></button></div>
    <div><div class="flabel"><span>Remind me<span class="new">New</span></span></div><div class="chips-wrap">${REMINDERS.map(([k, n]) => `<button class="chip" data-act="reminder" data-arg="${k}" ${pressed(d.reminder, k)}>${n}</button>`).join('')}</div></div>`;
  },
  background: d => {
    const L = d.look, bg = L.bg, ci = contrastInfo(L);
    const pane = {
      color: () => `<div class="swatches">${COLORS.map(([n, h]) => `<button class="sw" style="background:${h}" data-act="color" data-arg="${h}" aria-label="${n}" ${pressed(bg.type === 'color' && bg.value.toUpperCase(), h)}></button>`).join('')}
        <label class="sw sw-custom" aria-label="Custom color" title="Custom color"><input type="color" data-field="color" value="${bg.type === 'color' ? bg.value : '#CDEFDF'}"></label></div>`,
      gradient: () => `<div class="tiles">${Object.entries(GRADS).map(([k, g]) => `<button class="tile-opt" style="${esc(`background:${g.css}`)}" data-act="grad" data-arg="${k}" ${pressed(bg.id, k)}><span class="lbl" style="color:${lum(g.base) > .2 ? '#111714' : '#fff'}">${g.name}</span></button>`).join('')}</div>`,
      photo: () => `<div class="tiles"><label class="tile-opt upload">${icon('upload')}Upload<input type="file" accept="image/*" data-field="photo" hidden></label>
        ${PHOTOS.map(id => `<button class="tile-opt" style="background-image:url('${thumb(id)}')" data-act="photo" data-arg="${id}" aria-label="Sample photo ${id}" ${pressed(bg.src, pic(id))}></button>`).join('')}</div>
        ${bg.type === 'photo' ? `<div><div class="flabel"><span>Focus point</span><span class="opt">tap the photo</span></div><div class="focal" data-act="focal" style="background-image:url('${esc(bg.src)}')"><i style="left:${bg.fx ?? 50}%;top:${bg.fy ?? 50}%"></i></div></div>` : ''}`,
      art: () => `<div class="tiles">${Object.entries(ART).map(([k, a]) => `<button class="tile-opt" style="${esc(`background:${svgURL(a.svg)} center/cover`)}" data-act="art" data-arg="${k}" ${pressed(bg.type === 'art' && bg.id, k)}><span class="lbl" style="color:${lum(a.base) > .2 ? '#111714' : '#fff'}">${a.name}</span></button>`).join('')}</div>`,
    };
    return `<div class="seg" role="group" aria-label="Background type">${[['photo', 'Photo'], ['color', 'Color'], ['gradient', 'Gradient'], ['art', 'Art']].map(([k, n]) => `<button data-act="bg-tab" data-arg="${k}" ${pressed(S.bgTab, k)}>${n}</button>`).join('')}</div>
      ${pane[S.bgTab]()}
      <div>
        <label class="slider-row">Darken<input type="range" min="0" max="70" value="${Math.round(L.dim * 100)}" data-field="dim"><output id="dim-out">${Math.round(L.dim * 100)}%</output></label>
        ${bg.type === 'photo' || bg.type === 'art' ? `<label class="slider-row">Blur<input type="range" min="0" max="16" value="${L.blur}" data-field="blur"><output id="blur-out">${L.blur}px</output></label>` : ''}
        <div class="contrast ${ci.ok ? '' : 'warn'}" id="contrast"><i></i>${esc(ci.text)}</div>
      </div>`;
  },
  style: d => {
    const L = d.look, n = strip(valueFor(d, 'days', calc(d)).num).slice(0, 4);
    return `<div><div class="flabel">Card style</div><div class="style-opts">${Object.entries(STYLES).map(([k, [name, sub]]) =>
      `<div class="style-opt" role="button" tabindex="0" data-act="style" data-arg="${k}" ${pressed(L.style, k)}>${card({ ...d, look: { ...L, style: k } }, 'mini')}<div class="lbl">${name}<small>${sub}</small></div></div>`).join('')}</div></div>
    <div><div class="flabel">Typeface</div><div class="font-opts">${Object.entries(FONTS).map(([k, name]) => `<button class="font-opt font-${k}" data-act="font" data-arg="${k}" ${pressed(L.font, k)}><b>${n}</b><span>${name}</span></button>`).join('')}</div></div>
    <div><div class="flabel">Text color</div><div class="seg">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-act="text" data-arg="${k}" ${pressed(L.text, k)}>${n}</button>`).join('')}</div>
      <div class="contrast ${contrastInfo(L).ok ? '' : 'warn'}"><i></i>${esc(contrastInfo(L).text)}</div></div>
    <div><div class="flabel">Count in</div><div class="chips-wrap">${UNITS.map(([k, n]) => `<button class="chip" data-act="draft-unit" data-arg="${k}" ${pressed(d.unit, k)}>${n}</button>`).join('')}</div></div>`;
  },
  sound: d => `<div class="tracks">${[[null, 'Silent']].concat(TRACKS).map(([t, sub]) => `<div class="track" role="radio" tabindex="0" aria-checked="${d.audio === t}" data-act="track" data-arg="${t || ''}">
      ${t ? `<button class="play" data-act="preview-track" data-arg="${t}" aria-label="Preview ${t}">${S.trackPreview === t ? '<span class="eq"><i></i><i></i><i></i></span>' : icon('play')}</button>` : `<span class="play">${icon('close')}</span>`}
      <div class="cl"><b>${t || 'No music'}</b><small>${t ? sub : 'Quiet detail page'}</small></div><span class="radio"></span></div>`).join('')}</div>
    <button class="switch-row" data-act="toast" data-arg="Opens the system file picker (FileKit). mp3, m4a, aac or ogg, up to 10 MB."><div><b>${icon('upload', 'mini')}Pick an audio file</b><small>mp3, m4a, aac, ogg · up to 10 MB</small></div>${icon('chev')}</button>
    <div><label class="slider-row">Volume<input type="range" min="0" max="100" value="70"><output>70%</output></label></div>
    <div class="switch-row"><div><b>Loop</b><small>Play again from the start</small></div><button class="switch" role="switch" aria-checked="true" aria-label="Loop" data-act="flip"></button></div>
    <div class="switch-row"><div><b>Fade in and out</b><small>1.5 s, no abrupt cuts</small></div><button class="switch" role="switch" aria-checked="true" aria-label="Fade" data-act="flip"></button></div>`,
};

function settingsView() {
  const st = S.settings;
  const sw = (k, label) => `<button class="switch" role="switch" aria-label="${label}" aria-checked="${st[k]}" data-act="set-flag" data-arg="${k}"></button>`;
  return `<section class="view" data-key="settings">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1 class="page-title">Settings</h1>
    <div class="profile"><span class="pic">🌤️</span><div><b>Guest</b><small>Saved on this device only</small></div><button class="btn btn-accent" data-act="toast" data-arg="Sign-in sheet: Google, email. Guest days move to the account.">Sign in</button></div>
    <p class="group-label">Appearance</p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('sun')}</span><span class="cl">Theme</span><div class="seg sm">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-act="theme" data-arg="${k}" ${pressed(st.theme, k)}>${n}</button>`).join('')}</div></div>
      <div class="cell"><span class="ci">${icon('palette')}</span><span class="cl">Accent</span><div class="accents">${ACCENTS.map(([k, h]) => `<button style="background:${h}" data-act="accent" data-arg="${k}" aria-label="Accent ${k}" ${pressed(st.accent, k)}></button>`).join('')}</div></div>
      <div class="cell"><span class="ci">${icon('pin')}</span><span class="cl">Big pinned card<small>Pinned day leads the Home screen</small></span>${sw('showHero', 'Big pinned card')}</div>
      <div class="cell"><span class="ci">${icon('grid')}</span><span class="cl">Home layout</span><div class="seg sm">${[['list', 'List'], ['grid', 'Grid']].map(([k, n]) => `<button data-act="layout-set" data-arg="${k}" ${pressed(S.layout, k)}>${n}</button>`).join('')}</div></div>
    </div>
    <p class="group-label">Counting</p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('sparkle')}</span><span class="cl">Count the first day as Day 1<small>“Day 1,972” instead of “1,971 days since”</small></span>${sw('dayOne', 'Count the first day as Day 1')}</div>
      <div class="cell"><span class="ci">${icon('calendar')}</span><span class="cl">Week starts on</span><div class="seg sm">${[['mon', 'Mon'], ['sun', 'Sun']].map(([k, n]) => `<button data-act="week" data-arg="${k}" ${pressed(st.weekStart, k)}>${n}</button>`).join('')}</div></div>
      <button class="cell" data-act="toast" data-arg="Holiday calendars per region are a recommended addition (see README)."><span class="ci">${icon('briefcase')}</span><span class="cl">Workdays skip<small>Saturdays and Sundays</small></span><span class="cv">Holidays<span class="new">New</span>${icon('chev')}</span></button>
    </div>
    <p class="group-label">Reminders<span class="new">New</span></p>
    <div class="group">
      <div class="cell"><span class="ci">${icon('bell')}</span><span class="cl">Notifications<small>Per-day reminders and milestones</small></span>${sw('notify', 'Notifications')}</div>
      <button class="cell" data-act="toast" data-arg="Time picker"><span class="ci">${icon('sun')}</span><span class="cl">Deliver at</span><span class="cv">9:00 AM${icon('chev')}</span></button>
    </div>
    <p class="group-label">More</p>
    <div class="group">
      <button class="cell" data-act="go" data-arg="widgets"><span class="ci">${icon('widgets')}</span><span class="cl">Widgets</span><span class="cv">${icon('chev')}</span></button>
      <button class="cell" data-act="toast" data-arg="Export to a JSON file, import from a file or a calendar (.ics)."><span class="ci">${icon('cloud')}</span><span class="cl">Backup and import<span class="new">New</span></span><span class="cv">${icon('chev')}</span></button>
      <button class="cell" data-act="toast" data-arg="Deleted days stay here for 30 days."><span class="ci">${icon('trash')}</span><span class="cl">Recently deleted<span class="new">New</span></span><span class="cv">${icon('chev')}</span></button>
      <button class="cell" data-act="toast" data-arg="Face ID / fingerprint lock and hiding private days from widgets."><span class="ci">${icon('lock')}</span><span class="cl">Privacy lock<span class="new">New</span></span><span class="cv">Off${icon('chev')}</span></button>
      <button class="cell" data-act="toast" data-arg="English, 简体中文, 繁體中文 …"><span class="ci">${icon('globe')}</span><span class="cl">Language</span><span class="cv">English${icon('chev')}</span></button>
    </div>
    <p class="foot">Days That Matter · design v2 prototype</p>
  </section>`;
}

function widgetLook(ev) {
  if (S.settings.widgetStyle === 'match') return ev;
  const value = S.settings.widgetStyle === 'minimal' ? (isDark() ? '#1E2522' : '#FFFFFF') : '#1F3D33';
  return { ...ev, look: { ...ev.look, bg: { type: 'color', value }, style: 'clean', dim: 0, blur: 0, text: 'auto' } };
}

function widgetsView() {
  const pin = pinned() || S.events[0];
  const next = S.events.filter(e => e !== pin).map(e => ({ e, c: calc(e) })).filter(r => !r.c.past).sort((a, b) => a.c.days - b.c.days).slice(0, 3);
  const second = next[0] ? next[0].e : pin;
  const w = widgetLook(pin), c = calc(pin), v = valueFor(pin, 'days', c);
  const medium = `<article class="${cardClass(w, 'wm')}" style="${cardVars(w.look)}">${layers(w.look)}<div class="card-body">
      <div class="lead"><span class="emo">${pin.emoji}</span><div>${count(v)}<div class="u">${v.u}</div><div class="t">${title(pin)}</div></div></div>
      <div class="next">${next.map(r => `<div><span>${r.e.emoji} ${esc(r.e.title)}</span><b>${r.c.today ? 'Today' : fmt(r.c.days) + 'd'}</b></div>`).join('')}</div></div></article>`;
  const start = parse(pin.created), pct = c.past ? 100 : Math.round(Math.min(1, diffDays(start, today()) / Math.max(1, diffDays(start, c.target))) * 100);
  const lockBg = pin.look.bg.type === 'photo' ? bgCSS(pin.look.bg) : GRADS.dusk.css;
  return `<section class="view" data-key="widgets">
    <div class="page-head"><button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button></div>
    <h1 class="page-title">Widgets</h1>
    <p class="lead">Widgets use each day's own look. Small shows one day, Medium adds what's next.</p>
    <div class="homescreen" style="${esc(`background:${GRADS.glacier.css}`)}">
      <div class="w-s">${card(w, 'ws')}</div>
      <div class="apps"><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span></div>
      <div class="w-m">${medium}</div>
      <div class="w-s">${card(widgetLook(second), 'ws')}</div>
      <div class="apps"><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span><span class="app-ic"></span></div>
    </div>
    <p class="group-label" style="margin-top:18px">Widget look</p>
    <div style="margin:0 16px 22px" class="seg">${[['match', 'Match card'], ['minimal', 'Minimal'], ['tinted', 'Tinted']].map(([k, n]) => `<button data-act="wstyle" data-arg="${k}" ${pressed(S.settings.widgetStyle, k)}>${n}</button>`).join('')}</div>
    <p class="group-label">Lock Screen</p>
    <div class="lock" style="${esc(`background:${lockBg}`)}">
      <div class="lock-date">${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      <div class="clock">${new Date().toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '')}</div>
      <div class="acc-row"><div class="acc-c" style="--p:${pct}%"><div><b>${c.today ? '🎉' : fmt(c.days)}</b><small>${c.past ? 'SINCE' : 'DAYS'}</small></div></div>
        <div class="acc-r">${pin.emoji} ${esc(pin.title)}<b>${strip(v.num)} ${strip(v.u)}</b></div></div>
    </div>
    <div style="height:30px"></div>
  </section>`;
}

function onboardingView() {
  const picks = ['together', 'norway', 'mia'].map(byId).filter(Boolean);
  return `<section class="view onb" data-key="onboarding">
    <div class="collage" aria-hidden="true">${picks.map((e, i) => `<div class="fl fl${i}">${card(e, 'row')}</div>`).join('')}</div>
    <div><h1>Count the days<br>that matter.</h1><p>Birthdays, trips, firsts and finish lines. Give each one its own photo or color.</p></div>
    <div class="onb-btns">
      <button class="btn btn-primary" data-act="start" data-arg="Signed in with Google"><span class="g-mark">G</span>Continue with Google</button>
      <button class="btn btn-ghost" data-act="start" data-arg="Email sign-in comes next">${icon('mail')}Continue with email</button>
      <button class="btn btn-text" data-act="start" data-arg="You're a guest. Days stay on this device.">Skip for now</button>
    </div>
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

const SHEETS = {
  actions: ({ id }) => {
    const ev = byId(id);
    return `<div class="sheet-card">${card(ev, 'row')}</div>
      <button class="menu-item" data-act="pin" data-arg="${id}">${icon('pin')}<span class="sp">${ev.pinned ? 'Unpin from top' : 'Pin to top'}</span>${!ev.pinned && pinned() ? `<small>replaces ${esc(pinned().title)}</small>` : ''}</button>
      <button class="menu-item" data-act="edit" data-arg="${id}">${icon('palette')}<span class="sp">Customize</span></button>
      <button class="menu-item" data-act="share" data-arg="${id}">${icon('share')}<span class="sp">Share</span></button>
      <button class="menu-item" data-act="duplicate" data-arg="${id}">${icon('duplicate')}<span class="sp">Duplicate</span></button>
      <button class="menu-item danger" data-act="delete" data-arg="${id}">${icon('trash')}<span class="sp">Delete</span></button>`;
  },
  sort: () => `<div class="sheet-h">Sort<button data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
    ${SORTS.map(([k, n]) => `<button class="menu-item" data-act="sort" data-arg="${k}"><span class="sp">${n}</span>${S.sort === k ? icon('check') : ''}</button>`).join('')}
    <p class="note">Drag to reorder (custom order) is listed in the README as a gap: the Event model has no sort field yet.</p>`,
  share: ({ id }) => {
    const ev = byId(id), f = S.share.format;
    const body = f === 'link'
      ? `<div class="link-box"><span>daysthatmatter.app/e/Q7fK2mXw9pLs0aRt4vYb8c</span><button data-act="toast" data-arg="Link copied">${icon('copy')}Copy</button></div>
        <div class="qr-wrap">${qrSVG(ev.id)}<div><b>Scan to open</b><p class="note" style="margin-top:4px">Made on the phone from the link, so it works offline once the link exists.</p></div></div>
        <div class="flabel">Link expires</div><div class="chips-wrap">${[['never', 'Never'], ['7', '7 days'], ['30', '30 days'], ['365', '1 year']].map(([k, n]) => `<button class="chip" data-act="expiry" data-arg="${k}" ${pressed(S.share.expiry, k)}>${n}</button>`).join('')}</div>
        <div class="info">${icon('info')}<span>People with the link see the title, date and theme. ${ev.look.bg.type === 'photo' ? '<b>Photos are not shared</b>; the page uses a matching color. ' : ''}Memos and music stay private. After edits, tap Update link.</span></div>
        <div class="btn-row"><button class="btn btn-ghost" data-act="toast" data-arg="Snapshot republished">Update link</button><button class="btn btn-primary" data-act="toast" data-arg="System share sheet">${icon('share')}Send</button></div>
        <button class="danger-link" data-act="revoke">Revoke link</button>`
      : `<div class="share-prev">${card(ev, f)}</div>
        <div class="switch-row" style="margin-bottom:12px"><div><b>Watermark</b><small>Small “Days That Matter” line</small></div><button class="switch" role="switch" aria-label="Watermark" aria-checked="${S.share.watermark}" data-act="watermark"></button></div>
        <div class="btn-row"><button class="btn btn-ghost" data-act="toast" data-arg="Saved to Photos">${icon('download')}Save</button><button class="btn btn-primary" data-act="toast" data-arg="System share sheet with the image">${icon('share')}Share</button></div>`;
    return `<div class="sheet-h">Share “${esc(ev.title)}”<button data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>
      <div class="seg" style="margin-bottom:14px">${[['story', 'Story 9:16'], ['square', 'Square'], ['link', 'Link & QR']].map(([k, n]) => `<button data-act="share-format" data-arg="${k}" ${pressed(f, k)}>${n}</button>`).join('')}</div>${body}`;
  },
};

function overlays() {
  let html = '';
  if (S.sheet) html += `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${SHEETS[S.sheet.type](S.sheet)}</div>`;
  if (S.toast) html += `<div class="toast" role="status"><span>${esc(S.toast.text)}</span>${S.toast.undo ? '<button data-act="undo">Undo</button>' : ''}</div>`;
  return html;
}

// ---------- render ----------
const VIEWS = { home: homeView, detail: detailView, editor: editorView, settings: settingsView, widgets: widgetsView, onboarding: onboardingView };

function render() {
  const old = app.querySelector('.view');
  if (old) scrollMem[old.dataset.key] = old.scrollTop;
  app.innerHTML = statusbar() + VIEWS[S.screen]() + overlays();
  const v = app.querySelector('.view');
  if (S.anim && S.anim !== 'none') v.classList.add('enter-' + S.anim);
  else v.classList.add('no-anim');
  v.scrollTop = S.anim && S.anim !== 'back' && S.anim !== 'none' ? 0 : scrollMem[v.dataset.key] || 0;
  S.anim = '';
  if (S.focus) { const el = app.querySelector(S.focus); if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); } S.focus = null; }
  renderPanel();
}

function go(screen, anim = 'right') { S.stack.push(S.screen); S.screen = screen; S.anim = anim; S.sheet = null; render(); }
function back() { if (S.screen === 'detail') S.playing = false; S.screen = S.stack.pop() || 'home'; S.anim = 'back'; S.sheet = null; render(); }
function jump(screen) { S.stack = screen === 'home' || screen === 'onboarding' ? [] : ['home']; S.screen = screen; S.anim = 'fade'; S.sheet = null; render(); }

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

// ---------- actions ----------
function openEditor(id, tab = 'details') {
  const src = id && byId(id);
  S.draft = src ? structuredClone(src) : {
    id: 'e' + Date.now().toString(36), title: '', emoji: '✨', date: toISO(addDays(today(), 30)), time: null, repeat: 'none', every: 10, category: 'life',
    pinned: false, unit: 'days', created: toISO(today()), reminder: 'day', audio: null, memos: [],
    look: { bg: { type: 'gradient', id: 'lagoon' }, dim: 0, blur: 0, style: 'glass', font: 'sans', text: 'auto' },
  };
  S.edTab = tab; S.bgTab = S.draft.look.bg.type; S.prevCtx = S.draft.pinned ? 'hero' : 'row'; S.trackPreview = null;
  go('editor', 'up');
}

function setPinned(id, on) {
  const before = S.events.map(e => e.pinned), prev = pinned();
  S.events.forEach(e => { e.pinned = on ? e.id === id : e.pinned && e.id !== id; });
  const ev = byId(id);
  toast(on ? (prev && prev.id !== id ? `Pinned “${ev.title}”. “${prev.title}” moved back to the list.` : `Pinned “${ev.title}”`) : 'Unpinned',
    () => S.events.forEach((e, i) => { e.pinned = before[i]; }));
}

const setLook = patch => { Object.assign(S.draft.look, patch); render(); };

const ACT = {
  go: a => go(a),
  back,
  open: a => { S.detailId = a; S.playing = false; go('detail'); if (calc(byId(a)).today) setTimeout(confetti, 250); },
  new: () => openEditor(null),
  edit: a => openEditor(a || S.detailId),
  'edit-sound': () => openEditor(S.detailId, 'sound'),
  search: () => { S.searching = !S.searching; if (!S.searching) S.query = ''; else S.focus = '.search input'; render(); },
  filter: a => { S.filter = a; render(); },
  layout: () => { S.layout = S.layout === 'list' ? 'grid' : 'list'; render(); },
  'layout-set': a => { S.layout = a; render(); },
  'sort-menu': () => { S.sheet = { type: 'sort' }; render(); },
  sort: a => { S.sort = a; S.sheet = null; render(); },
  more: a => { S.sheet = { type: 'actions', id: a }; render(); },
  pin: a => { S.sheet = null; setPinned(a, !byId(a).pinned); render(); },
  delete: a => {
    const i = S.events.findIndex(e => e.id === a), [ev] = S.events.splice(i, 1);
    S.sheet = null; toast(`Deleted “${ev.title}”`, () => S.events.splice(i, 0, ev));
    if (S.screen === 'detail') back(); else render();
  },
  duplicate: a => {
    const copy = { ...structuredClone(byId(a)), id: 'e' + Date.now().toString(36), pinned: false, memos: [], created: toISO(today()) };
    copy.title = `${copy.title} (copy)`.slice(0, 40); S.events.push(copy); S.sheet = null; toast('Duplicated'); render();
  },
  share: a => { S.sheet = { type: 'share', id: a || S.detailId }; render(); },
  'share-format': a => { S.share.format = a; render(); },
  watermark: () => { S.share.watermark = !S.share.watermark; render(); },
  expiry: a => { S.share.expiry = a; render(); },
  revoke: () => { S.sheet = null; toast('Link revoked. Anyone opening it now sees “no longer available”.'); render(); },
  'close-sheet': () => { S.sheet = null; render(); },
  undo: () => { S.toast?.undo?.(); S.toast = null; render(); },
  unit: a => { byId(S.detailId).unit = a; render(); },
  'cycle-unit': () => { const ev = byId(S.detailId), i = UNITS.findIndex(u => u[0] === ev.unit); ev.unit = UNITS[(i + 1) % UNITS.length][0]; render(); },
  audio: () => { S.playing = !S.playing; render(); },
  'focus-memo': () => { const el = app.querySelector('[data-field="memo"]'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); },
  'add-memo': () => {
    const el = app.querySelector('[data-field="memo"]'), text = el.value.trim(); if (!text) return el.focus();
    const ev = byId(S.detailId), c = calc(ev), n = c.days + (S.settings.dayOne ? 1 : 0);
    ev.memos.push({ date: toISO(today()), author: 'You', text, tag: c.past && MILESTONES.includes(n) ? `Day ${fmt(n)}` : null });
    toast('Memo added'); render();
  },
  // editor
  cancel: () => { S.draft = null; back(); },
  save: () => {
    const d = S.draft;
    if (!d.title.trim()) { toast('Give it a name first'); S.edTab = 'details'; S.focus = '[data-field="title"]'; render(); return; }
    d.title = d.title.trim();
    const i = S.events.findIndex(e => e.id === d.id), isNew = i < 0, prev = pinned();
    if (isNew) S.events.push(d); else S.events[i] = d;
    if (d.pinned) S.events.forEach(e => { e.pinned = e.id === d.id; });
    S.draft = null; S.screen = S.stack.pop() || 'home';
    if (isNew) { S.stack.push(S.screen); S.screen = 'detail'; S.detailId = d.id; }
    S.anim = 'fade';
    toast(d.pinned && prev && prev.id !== d.id ? `Saved and pinned. “${prev.title}” moved back to the list.` : 'Saved');
    render();
  },
  'ed-tab': a => { S.edTab = a; render(); },
  'prev-ctx': a => { S.prevCtx = a; render(); },
  emoji: a => { S.draft.emoji = a; render(); },
  repeat: a => { S.draft.repeat = a; render(); },
  cat: a => { S.draft.category = a; render(); },
  reminder: a => { S.draft.reminder = a; render(); },
  'draft-pin': () => { S.draft.pinned = !S.draft.pinned; if (S.draft.pinned) S.prevCtx = 'hero'; render(); },
  'draft-unit': a => { S.draft.unit = a; render(); },
  'bg-tab': a => { S.bgTab = a; render(); },
  color: a => setLook({ bg: { type: 'color', value: a }, dim: 0, blur: 0 }),
  grad: a => setLook({ bg: { type: 'gradient', id: a }, dim: 0, blur: 0 }),
  art: a => setLook({ bg: { type: 'art', id: a }, dim: 0 }),
  photo: a => setLook({ bg: { type: 'photo', src: pic(a), fx: 50, fy: 50 }, dim: Math.max(S.draft.look.dim, .25) }),
  focal: (a, el, e) => {
    const r = el.getBoundingClientRect(), bg = S.draft.look.bg;
    bg.fx = Math.round((e.clientX - r.left) / r.width * 100); bg.fy = Math.round((e.clientY - r.top) / r.height * 100);
    el.querySelector('i').style.cssText = `left:${bg.fx}%;top:${bg.fy}%`; refreshPreview();
  },
  style: a => setLook({ style: a }),
  font: a => setLook({ font: a }),
  text: a => setLook({ text: a }),
  track: a => { S.draft.audio = a || null; render(); },
  'preview-track': a => { S.trackPreview = S.trackPreview === a ? null : a; render(); },
  flip: (a, el) => el.setAttribute('aria-checked', el.getAttribute('aria-checked') !== 'true'),
  // settings
  theme: a => { S.settings.theme = a; applyTheme(); render(); },
  accent: a => { S.settings.accent = a; applyTheme(); render(); },
  'set-flag': a => { S.settings[a] = !S.settings[a]; render(); },
  week: a => { S.settings.weekStart = a; render(); },
  wstyle: a => { S.settings.widgetStyle = a; render(); },
  start: a => { jump('home'); toast(a); render(); },
  toast: a => { toast(a); render(); },
};

let longFired = false, longTimer;
app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !app.contains(t)) return;
  if (longFired) { longFired = false; return; }
  ACT[t.dataset.act]?.(t.dataset.arg, t, e);
});
app.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; return render(); }
  if (t.dataset?.field === 'memo' && e.key === 'Enter') return ACT['add-memo']();
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="button"][data-act], [role="radio"][data-act]')) { e.preventDefault(); t.click(); }
});
// Long-press (touch) or right-click opens the card actions: pin, customize, share, delete.
app.addEventListener('pointerdown', e => {
  const c = e.target.closest('[data-long]'); if (!c) return;
  longFired = false;
  longTimer = setTimeout(() => { longFired = true; navigator.vibrate?.(10); S.sheet = { type: 'actions', id: c.dataset.long }; render(); }, 480);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => app.addEventListener(t, () => clearTimeout(longTimer)));
app.addEventListener('scroll', () => clearTimeout(longTimer), true);
app.addEventListener('contextmenu', e => {
  const c = e.target.closest('[data-long]'); if (!c) return;
  e.preventDefault(); S.sheet = { type: 'actions', id: c.dataset.long }; render();
});

app.addEventListener('input', e => {
  const f = e.target.dataset.field, val = e.target.value, d = S.draft;
  if (f === 'query') { S.query = val; S.focus = '.search input'; render(); }
  else if (f === 'title') { d.title = val; app.querySelector('#title-count').textContent = `${val.length}/40`; refreshPreview(); }
  else if (f === 'dim') { d.look.dim = val / 100; app.querySelector('#dim-out').textContent = `${val}%`; refreshPreview(); }
  else if (f === 'blur') { d.look.blur = +val; app.querySelector('#blur-out').textContent = `${val}px`; refreshPreview(); }
  else if (f === 'color') { d.look.bg = { type: 'color', value: val.toUpperCase() }; refreshPreview(); }
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
  ['onboarding', 'Welcome', 'First launch, guest in one tap'],
  ['home', 'Home', 'Long-press or right-click a card to pin it'],
  ['detail', 'Day', 'Tap the big number to change units'],
  ['editor', 'Customize', 'Photo, color, style, font, sound'],
  ['share', 'Share', 'Story image, square, link and QR'],
  ['widgets', 'Widgets', 'Home and Lock Screen'],
  ['settings', 'Settings', 'Theme, accent, counting rules'],
];
function renderPanel() {
  const cur = S.sheet?.type === 'share' ? 'share' : S.screen;
  panel.innerHTML = `<div class="brand"><svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--accent)"/><circle cx="20" cy="21" r="6" fill="var(--on-accent)"/><path d="M10 27.5h20" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round"/><path d="M20 9.5v3M11.5 13l2 2M28.5 13l-2 2" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round"/></svg>
    <div><b>Days That Matter</b><small>Design v2 · interactive prototype</small></div></div>
    <p class="panel-text">Quiet, light chrome. Each day card brings its own photo, color or art. One pinned day leads Home.</p>
    <nav class="nav" aria-label="Screens">${SCREENS.map(([k, n, hint]) => `<button data-pact="${k}" aria-current="${cur === k}">${n}<small>${hint}</small></button>`).join('')}</nav>
    <div class="seg sm" role="group" aria-label="Theme">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, n]) => `<button data-ptheme="${k}" ${pressed(S.settings.theme, k)}>${n}</button>`).join('')}</div>
    <div class="panel-foot"><a href="README.md">Design notes &amp; gaps</a><button data-pact="reset">Reset demo</button></div>`;
  panel.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.pact;
  if (b.dataset.ptheme) { S.settings.theme = b.dataset.ptheme; applyTheme(); render(); return; }
  if (k === 'reset') { S.events = seed(); S.settings.dayOne = false; S.sheet = null; S.filter = 'all'; S.query = ''; S.searching = false; jump('home'); return; }
  if (k === 'editor') { S.stack = []; S.screen = 'home'; openEditor(S.detailId && byId(S.detailId) ? S.detailId : pinned()?.id, 'background'); return; }
  if (k === 'detail' || k === 'share') { if (!byId(S.detailId)) S.detailId = (pinned() || S.events[0]).id; jump('detail'); if (k === 'share') { S.sheet = { type: 'share', id: S.detailId }; render(); } return; }
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
  if (t) t.textContent = new Date().toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '');
}, 1000);
fit(); applyTheme(); render();
