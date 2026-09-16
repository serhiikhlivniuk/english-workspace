/* ===== English Workspace — data + progress store =====
   Works with no backend at all: everything goes to localStorage.
   If supabase.url and supabase.anonKey are filled in data/config.json,
   the same data is mirrored to Supabase so the teacher can see progress. */

const EW = (() => {
  const BASE = document.documentElement.dataset.base || '';
  const LS = 'ew:v1:';
  let cfg = null, sb = null;

  /* ---------- data ---------- */
  const cache = {};
  async function data(name) {
    if (!cache[name]) {
      cache[name] = fetch(`${BASE}data/${name}.json`, { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); });
    }
    return cache[name];
  }
  async function config() {
    if (!cfg) {
      cfg = await data('config');
      const s = cfg.supabase || {};
      if (s.url && s.anonKey) sb = {
        url: s.url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''),
        key: s.anonKey.trim(),
        student: s.studentId || 'student-1'
      };
    }
    return cfg;
  }

  /* ---------- local storage ---------- */
  function get(key, fallback) {
    try { const v = localStorage.getItem(LS + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch { /* private mode */ }
    push('progress', { key, value });
    return value;
  }

  /* ---------- supabase (REST, no SDK) ---------- */
  async function sbFetch(path, opts = {}) {
    if (!sb) return null;
    try {
      const r = await fetch(`${sb.url}/rest/v1/${path}`, {
        ...opts,
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          ...(opts.headers || {})
        }
      });
      if (!r.ok) return null;
      const t = await r.text();
      return t ? JSON.parse(t) : true;
    } catch { return null; }
  }
  function push(kind, payload) {
    if (!sb) return;
    if (kind === 'progress') {
      sbFetch('progress?on_conflict=student_id,key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ student_id: sb.student, key: payload.key, value: payload.value, updated_at: new Date().toISOString() })
      });
    } else {
      sbFetch('events', {
        method: 'POST',
        body: JSON.stringify({ student_id: sb.student, kind, payload, created_at: new Date().toISOString() })
      });
    }
  }
  const connected = () => !!sb;
  const read = (table, query = '') => sbFetch(`${table}?${query}`);

  /* ---------- schedule ---------- */
  function nextLesson(meet) {
    const now = new Date();
    let best = null;
    for (const s of meet.schedule) {
      const [h, m] = s.time.split(':').map(Number);
      for (let add = 0; add <= 7; add++) {
        const d = new Date(now);
        d.setDate(now.getDate() + add);
        d.setHours(h, m, 0, 0);
        if (d.getDay() !== s.dayIndex % 7 || d <= now) continue;
        if (!best || d < best.date) best = { date: d, slot: s };
        break;
      }
    }
    return best;
  }
  function humanUntil(date) {
    const ms = date - new Date();
    if (ms <= 0) return 'right now';
    const days = Math.floor(ms / 864e5), hours = Math.floor(ms / 36e5) % 24, mins = Math.floor(ms / 6e4) % 60;
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (days) return `in ${pl(days, 'day')} ${pl(hours, 'hour')}`;
    if (hours) return `in ${pl(hours, 'hour')} ${pl(mins, 'minute')}`;
    return `in ${pl(mins, 'minute')}`;
  }

  return { BASE, data, config, get, set, push, connected, read, nextLesson, humanUntil };
})();
