/* ===== Lesson worksheet sync =====
   Student mode (default):
     - on load, pulls the saved answers from Supabase and fills every field that is
       empty in this browser, so a second device or a cleared browser never starts blank;
     - every change is merged into what the database already has (never a blind
       overwrite) and pushed ~0.8 s after the student stops typing.
   Teacher mode (add ?watch to the URL, e.g. lessons/lesson-05.html?watch):
     - read-only live mirror of the student's worksheet, refreshed every 3 s,
       green / red marking, and a flash on every field that has just changed.
       Nothing is written anywhere in this mode.                                   */
(() => {
  const script = document.currentScript;
  const id = script?.dataset.lesson || 'lesson';
  const key = `lesson:${id}:answers`;
  const params = new URLSearchParams(location.search);
  const WATCH = params.has('watch') || params.has('live');
  const POLL_MS = 3000;

  /* ---------- reading and writing the worksheet ---------- */
  const fields = () => Array.from(document.querySelectorAll('input, textarea, select'))
    .filter(el => el.type !== 'button' && el.type !== 'submit');
  const fkey = (el, i) => el.id || el.name || `f${i}`;

  function collect() {
    const out = {};
    fields().forEach((el, i) => {
      if (el.type === 'radio') {
        const g = el.closest('[data-radio]');
        if (el.checked) out[`radio:${g ? g.dataset.radio : el.name}`] = el.value;
        return;
      }
      const v = el.type === 'checkbox' ? el.checked : el.value;
      if (v === false || (typeof v === 'string' && !v.trim())) return;
      out[fkey(el, i)] = v;
    });
    document.querySelectorAll('.tf[data-tf]').forEach(g => {
      const b = g.querySelector('button[aria-pressed="true"]');
      if (b) out[`tf:${g.dataset.tf}`] = b.value;
    });
    return out;
  }

  function norm(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[‘’ʼ`]/g, "'").replace(/[.,!?;:]+$/, '').replace(/\s+/g, ' ');
  }
  const matches = (v, ans) => ans.split('|').map(norm).includes(norm(v));

  /* apply(answers, all): all=true mirrors exactly (teacher); all=false only fills blanks (student) */
  function apply(ans, all) {
    const changed = [];
    fields().forEach((el, i) => {
      if (el.type === 'radio') return;
      const k = fkey(el, i);
      const has = Object.prototype.hasOwnProperty.call(ans, k);
      const filled = el.type === 'checkbox' ? el.checked : !!el.value.trim();
      if (!all && (!has || filled)) return;
      if (el.type === 'checkbox') {
        const v = has ? !!ans[k] : false;
        if (el.checked !== v) { el.checked = v; changed.push(el); }
        return;
      }
      const v = has ? String(ans[k]) : '';
      if (el.value === v) return;
      el.value = v; changed.push(el);
      if (!all) {                      // let the page save it in its own local store
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    document.querySelectorAll('[data-radio]').forEach(g => {
      const want = ans[`radio:${g.dataset.radio}`];
      const cur = g.querySelector('input[type=radio]:checked');
      if (!all && (cur || want == null)) return;
      g.querySelectorAll('input[type=radio]').forEach(r => {
        const on = r.value === want;
        if (r.checked === on) return;
        r.checked = on;
        if (on) changed.push(r.closest('label') || r);
        if (on && !all) r.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    document.querySelectorAll('.tf[data-tf]').forEach(g => {
      const want = ans[`tf:${g.dataset.tf}`];
      const cur = g.querySelector('button[aria-pressed="true"]');
      if (!all && (cur || want == null)) return;
      if (all) {
        g.querySelectorAll('button').forEach(b => {
          const on = b.value === want;
          if ((b.getAttribute('aria-pressed') === 'true') === on) return;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          if (on) changed.push(b);
        });
      } else {
        const b = g.querySelector(`button[value="${want}"]`);
        if (b) b.click();              // the page's own handler saves it locally
      }
    });
    return changed;
  }

  /* ---------- teacher: live read-only mirror ---------- */
  function markAll() {
    fields().forEach(el => {
      const a = el.getAttribute('data-answer');
      if (!a) return;
      el.classList.remove('ok', 'bad');
      if (el.value.trim()) el.classList.add(matches(el.value, a) ? 'ok' : 'bad');
    });
    document.querySelectorAll('.tf[data-answer]').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.classList.remove('ok', 'bad');
        if (b.getAttribute('aria-pressed') === 'true') b.classList.add(b.value === g.dataset.answer ? 'ok' : 'bad');
      });
    });
    document.querySelectorAll('.rgroup[data-answer]').forEach(g => {
      g.querySelectorAll('input[type=radio]').forEach(r => {
        const l = r.closest('.choice') || r.parentElement;
        l.classList.remove('ok', 'bad');
        if (r.checked) l.classList.add(r.value === g.dataset.answer ? 'ok' : 'bad');
      });
    });
  }

  async function watch() {
    const css = document.createElement('style');
    css.textContent = `
      .ew-live{position:fixed;right:14px;bottom:14px;z-index:200;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
        max-width:calc(100vw - 28px);background:#17233D;color:#fff;border-radius:12px;padding:10px 14px;
        font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.3)}
      .ew-live .dot{width:9px;height:9px;border-radius:50%;background:#FF4D4D;animation:ewp 1.4s infinite}
      .ew-live.stale .dot{background:#999;animation:none}
      .ew-live button{font:inherit;background:rgba(255,255,255,.16);color:#fff;border:0;border-radius:8px;padding:5px 10px;cursor:pointer}
      .ew-live small{font-weight:400;opacity:.75}
      .ew-flash{animation:ewf 2.4s ease-out}
      @keyframes ewp{50%{opacity:.35}}
      @keyframes ewf{0%{box-shadow:0 0 0 4px #FFD24D}100%{box-shadow:0 0 0 0 transparent}}
      input[readonly],textarea[readonly]{cursor:default}
      .tf button{pointer-events:none}
      @media (prefers-reduced-motion: reduce){.ew-live .dot,.ew-flash{animation:none}}`;
    document.head.appendChild(css);

    const bar = document.createElement('div');
    bar.className = 'ew-live stale';
    bar.innerHTML = '<span class="dot"></span><span class="txt">LIVE · connecting…</span><small class="when"></small><button type="button" class="jump" hidden>Jump to last change</button>';
    document.body.appendChild(bar);
    const txt = bar.querySelector('.txt'), when = bar.querySelector('.when'), jump = bar.querySelector('.jump');

    // freeze the sheet: in this mode the teacher only watches
    fields().forEach(el => {
      if (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') el.disabled = true;
      else el.readOnly = true;
    });
    document.querySelectorAll('[data-reveal]').forEach(b => { b.disabled = true; b.title = 'Disabled in live view'; });

    const cfg = await EW.config();
    if (!EW.connected()) { txt.textContent = 'LIVE view needs Supabase in data/config.json'; return; }
    const who = cfg.student || 'student';
    const sid = (cfg.supabase || {}).studentId || 'student-1';
    let lastStamp, lastEl = null, lastSeen = 0, first = true;

    jump.onclick = () => lastEl && lastEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    async function tick() {
      const rows = await EW.read('progress', `student_id=eq.${encodeURIComponent(sid)}&key=eq.${encodeURIComponent(key)}&select=value,updated_at`);
      if (!rows) { bar.classList.add('stale'); txt.textContent = 'LIVE · no connection, retrying…'; return; }
      bar.classList.remove('stale');
      const v = rows[0] ? rows[0].value : null;
      const stamp = v ? v.updated : null;
      if (first || stamp !== lastStamp) {
        const changed = apply((v && v.answers) || {}, true);
        markAll();
        if (!first) changed.forEach(el => { el.classList.remove('ew-flash'); void el.offsetWidth; el.classList.add('ew-flash'); });
        if (changed.length && !first) { lastEl = changed[changed.length - 1]; jump.hidden = false; }
        lastStamp = stamp; first = false;
        lastSeen = stamp ? Date.parse(stamp) : 0;
      }
      txt.textContent = `LIVE · ${who} · ${v ? v.filled || 0 : 0} fields`;
      if (lastSeen) {
        const s = Math.max(0, Math.round((Date.now() - lastSeen) / 1000));
        when.textContent = s < 60 ? `typed ${s}s ago` : s < 3600 ? `typed ${Math.round(s / 60)} min ago`
          : `last change ${new Date(lastSeen).toLocaleString('en-GB')}`;
      } else when.textContent = 'nothing typed yet';
    }
    tick();
    setInterval(tick, POLL_MS);
  }

  /* ---------- student: hydrate first, then merge-and-push ---------- */
  function student() {
    let remote = {};      // what the database holds (kept up to date after each push)
    let ready = false;    // never push before we know what the database has
    let t;
    const payload = () => {
      const a = { ...remote, ...collect() };
      return { updated: new Date().toISOString(), filled: Object.keys(a).length, answers: a };
    };
    const push = () => { if (!ready) return; const p = payload(); remote = p.answers; EW.set(key, p); };
    const sync = () => { clearTimeout(t); t = setTimeout(push, 800); };

    // a field the student empties on purpose must not come back from the database
    const forget = e => {
      const el = e.target;
      if (!el || !el.matches || !el.matches('input, textarea, select')) return;
      if (el.type === 'checkbox' || el.type === 'radio' || el.value.trim()) return;
      delete remote[fkey(el, fields().indexOf(el))];
    };
    document.addEventListener('input', e => { forget(e); sync(); });
    document.addEventListener('change', e => { forget(e); sync(); });
    document.addEventListener('click', e => {
      if (e.target.closest && e.target.closest('.tf button, [data-reveal]')) sync();
    });
    window.addEventListener('pagehide', () => { if (ready && Object.keys(collect()).length) push(); });

    (async () => {
      try {
        const cfg = await EW.config();
        if (EW.connected()) {
          const sid = (cfg.supabase || {}).studentId || 'student-1';
          const rows = await Promise.race([
            EW.read('progress', `student_id=eq.${encodeURIComponent(sid)}&key=eq.${encodeURIComponent(key)}&select=value`),
            new Promise(r => setTimeout(() => r(null), 5000))
          ]);
          if (rows && rows[0] && rows[0].value && rows[0].value.answers) {
            remote = { ...rows[0].value.answers };
            for (const k of Object.keys(remote)) if (typeof remote[k] === 'string' && !remote[k].trim()) delete remote[k];
            apply(remote, false);
          }
        }
      } catch { /* offline: the page's local answers still work */ }
      ready = true;
      const local = collect();
      if (Object.keys(local).some(k => remote[k] !== local[k])) sync();
    })();
  }

  WATCH ? watch() : student();
})();
