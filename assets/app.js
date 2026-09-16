/* ===== English Workspace — shared UI ===== */
(() => {
  const B = document.documentElement.dataset.base || '';
  const PAGES = [
    ['index.html', 'Home', '🏠'],
    ['lessons.html', 'Lessons', '📘'],
    ['vocabulary.html', 'Vocabulary', '🔤'],
    ['grammar.html', 'Grammar', '🧩'],
    ['links.html', 'Links', '🔗'],
    ['homework.html', 'Homework', '✅']
  ];

  /* ---- theme ---- */
  const saved = (() => { try { return localStorage.getItem('ew:theme'); } catch { return null; } })();
  if (saved) document.documentElement.dataset.theme = saved;
  window.ewToggleTheme = () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ew:theme', next); } catch {}
    paintThemeBtn();
  };
  function paintThemeBtn() {
    const btn = document.querySelector('.theme-btn');
    if (!btn) return;
    const dark = (document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Світла тема' : 'Темна тема');
  }

  /* ---- chrome ---- */
  const here = location.pathname.split('/').pop() || 'index.html';
  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `<div class="topbar-in">
    <a class="brand" href="${B}index.html"><span class="dot">EN</span> English Workspace</a>
    <nav class="nav">${PAGES.map(([h, t, e]) =>
      `<a href="${B}${h}"${h === here ? ' aria-current="page"' : ''}><span aria-hidden="true">${e}</span> ${t}</a>`).join('')}</nav>
    <button class="theme-btn" onclick="ewToggleTheme()" type="button">☾</button>
  </div>`;
  document.body.prepend(bar);
  paintThemeBtn();

  document.addEventListener('DOMContentLoaded', async () => {
    const wrap = document.querySelector('.wrap');
    if (!wrap || document.querySelector('.footer')) return;
    const f = document.createElement('footer');
    f.className = 'footer';
    f.innerHTML = `<span>English Workspace · матеріали для наших занять</span>
      <span class="sync" id="ew-sync">локально</span>`;
    wrap.appendChild(f);
    try {
      await EW.config();
      if (EW.connected()) { const s = document.getElementById('ew-sync'); s.textContent = 'синхронізується'; s.classList.add('on'); }
    } catch {}
  });

  /* ---- helpers ---- */
  window.esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  };
})();
