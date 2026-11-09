'use strict';
/* 3.10 · Calendário da app nos campos de data, no computador (rato e teclado).
   Cada <input type="date"> continua no formulário (é ele que guarda o valor, AAAA-MM-DD); fica escondido e no seu lugar
   aparece um botão com a data por extenso, que abre o calendário. No telemóvel e no tablet fica o seletor do sistema. */
(function () {
  const fine = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
  const ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  const CHEV = d => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;

  function label(d, input) {
    if (!d) return input.classList.contains('qt-date') ? 'Outra data' : (input.required ? 'Escolher data' : 'Sem data');
    const t = today0(); const diff = Math.round((d - t) / 864e5);
    const base = `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ' de ' + d.getFullYear() : ''}`;
    if (input.name === 'birthDate') return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
    return diff === 0 ? 'Hoje · ' + base : diff === 1 ? 'Amanhã · ' + base : diff === -1 ? 'Ontem · ' + base : base;
  }
  // Atalhos conforme o campo.
  function shortcuts(input) {
    const t = today0(); const n = input.name;
    if (input.classList.contains('qt-date')) return [];
    if (n === 'birthDate') return null; // usa a escolha do ano
    if (n === 'date' || n === 'transactionDate') return [['Hoje', t], ['Ontem', addDays(t, -1)]];
    if (n === 'maturityDate') return [['Daqui a 1 mês', addMonths(t, 1)], ['3 meses', addMonths(t, 3)], ['6 meses', addMonths(t, 6)], ['1 ano', addMonths(t, 12)]];
    const sat = addDays(t, ((6 - t.getDay() + 7) % 7) || 7);
    return [['Hoje', t], ['Amanhã', addDays(t, 1)], ['Sábado', sat], ['Daqui a 1 semana', addDays(t, 7)]];
  }

  let pop = null, cur = null; // calendário aberto e o campo a que pertence
  function inRange(d, input) { const mn = parse(input.min), mx = parse(input.max); return !(mn && d < mn) && !(mx && d > mx); }
  function set(input, d) {
    input.value = d ? iso(d) : '';
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    sync(input);
  }
  function sync(input) {
    const b = input._dcBtn; if (!b) return; const d = parse(input.value);
    b.querySelector('.dp-text').textContent = label(d, input); b.classList.toggle('empty', !d);
    b.disabled = input.disabled;
  }
  function close(back = true) { if (!pop) return; const input = cur; pop.remove(); pop = null; cur = null; if (input?._dcBtn) { input._dcBtn.setAttribute('aria-expanded', 'false'); if (back) input._dcBtn.focus(); } document.removeEventListener('mousedown', outside, true); }
  function outside(e) { if (pop && !pop.contains(e.target) && !cur?._dcBtn?.contains(e.target)) close(false); }

  function open(input) {
    close(false); cur = input; const btn = input._dcBtn; btn.setAttribute('aria-expanded', 'true');
    const t = today0(); let sel = parse(input.value); let focus = sel || (inRange(t, input) ? t : (parse(input.max) || t)); let view = new Date(focus.getFullYear(), focus.getMonth(), 1);
    pop = document.createElement('div'); pop.className = 'dp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Escolher data');
    const sc = shortcuts(input);
    function years() { const mx = parse(input.max) || addMonths(t, 120), mn = parse(input.min) || new Date(1920, 0, 1); let o = ''; for (let y = mx.getFullYear(); y >= mn.getFullYear(); y--) o += `<option value="${y}" ${y === view.getFullYear() ? 'selected' : ''}>${y}</option>`; return o; }
    function draw() {
      const first = new Date(view); const off = (first.getDay() + 6) % 7; const start = addDays(first, -off);
      let days = ''; for (let i = 0; i < 42; i++) {
        const d = addDays(start, i); const ok = inRange(d, input);
        const cls = ['dp-day', d.getMonth() !== view.getMonth() ? 'out' : '', (d.getDay() === 0 || d.getDay() === 6) ? 'wk' : '', +d === +t ? 'today' : '', sel && +d === +sel ? 'sel' : '', +d === +focus ? 'focus' : ''].filter(Boolean).join(' ');
        days += `<button type="button" class="${cls}" data-d="${iso(d)}" tabindex="${+d === +focus ? 0 : -1}" aria-label="${label(d, input)}"${sel && +d === +sel ? ' aria-selected="true"' : ''}${ok ? '' : ' disabled'}>${d.getDate()}</button>`;
      }
      const head = sc === null
        ? `<div class="dp-mh dp-mh-sel"><select class="dp-month" aria-label="Mês">${MONTHS.map((m, i) => `<option value="${i}" ${i === view.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select><select class="dp-year" aria-label="Ano">${years()}</select><span class="dp-navs"><button type="button" class="dp-nav" data-nav="-1" aria-label="Mês anterior">${CHEV('M15 6l-6 6 6 6')}</button><button type="button" class="dp-nav" data-nav="1" aria-label="Mês seguinte">${CHEV('M9 6l6 6-6 6')}</button></span></div>`
        : `<div class="dp-mh"><button type="button" class="dp-nav" data-nav="-1" aria-label="Mês anterior">${CHEV('M15 6l-6 6 6 6')}</button><b aria-live="polite">${MONTHS[view.getMonth()]} ${view.getFullYear()}</b><button type="button" class="dp-nav" data-nav="1" aria-label="Mês seguinte">${CHEV('M9 6l6 6-6 6')}</button></div>`;
      pop.innerHTML = `${sc && sc.length ? `<div class="dp-chips">${sc.filter(([, d]) => inRange(d, input)).map(([l, d]) => `<button type="button" class="dp-chip" data-d="${iso(d)}">${l}</button>`).join('')}</div>` : ''}${head}
        <div class="dp-wd" aria-hidden="true"><span>seg</span><span>ter</span><span>qua</span><span>qui</span><span>sex</span><span>sáb</span><span>dom</span></div>
        <div class="dp-days" role="grid">${days}</div>
        <div class="dp-foot">${input.required ? '<span></span>' : '<button type="button" class="dp-link muted" data-clear>Sem data</button>'}${inRange(t, input) ? '<button type="button" class="dp-link" data-d="' + iso(t) + '">Hoje</button>' : ''}</div>`;
    }
    const refocus = () => pop.querySelector('.dp-days [tabindex="0"]')?.focus();
    draw(); document.body.appendChild(pop); place(btn); refocus();
    pop.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'); if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1); focus = new Date(view); draw(); return; }
      if (e.target.closest('[data-clear]')) { set(input, null); close(); return; }
      const b = e.target.closest('[data-d]'); if (b && !b.disabled) { set(input, parse(b.dataset.d)); close(); }
    });
    pop.addEventListener('change', e => { if (e.target.matches('.dp-month,.dp-year')) { const m = +pop.querySelector('.dp-month').value, y = +pop.querySelector('.dp-year').value; view = new Date(y, m, 1); focus = new Date(view); draw(); e.target.classList.contains('dp-year') ? pop.querySelector('.dp-year')?.focus() : pop.querySelector('.dp-month')?.focus(); } });
    pop.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') { const f = [...pop.querySelectorAll('button:not([disabled]),select')].filter(x => x.tabIndex !== -1); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
      if (!e.target.closest('.dp-days')) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step) focus = addDays(focus, step); else if (e.key === 'PageUp') focus = addMonths(focus, -1); else if (e.key === 'PageDown') focus = addMonths(focus, 1);
      else if (e.key === 'Home') focus = addDays(focus, -((focus.getDay() + 6) % 7)); else if (e.key === 'End') focus = addDays(focus, 6 - ((focus.getDay() + 6) % 7));
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (inRange(focus, input)) { set(input, focus); close(); } return; } else return;
      e.preventDefault(); view = new Date(focus.getFullYear(), focus.getMonth(), 1); draw(); refocus();
    });
    setTimeout(() => document.addEventListener('mousedown', outside, true));
  }
  // Abre por baixo do campo (ou por cima, se não couber), sem sair do ecrã.
  function place(btn) {
    const r = btn.getBoundingClientRect(); const w = pop.offsetWidth, h = pop.offsetHeight; const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.left), vw - w - 8); let top = r.bottom + 8; if (top + h > vh - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
  }
  window.addEventListener('resize', () => close(false)); document.addEventListener('scroll', e => { if (pop && !pop.contains(e.target)) close(false); }, true);

  function enhance(input) {
    if (input._dcBtn || !fine()) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dp-btn' + (input.classList.contains('qt-date') ? ' dp-btn-chip' : '');
    b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
    if (input.id) { const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`); if (l) { b.id = input.id + '-dp'; l.htmlFor = b.id; } }
    if (input.getAttribute('aria-label')) b.setAttribute('aria-label', input.getAttribute('aria-label'));
    b.innerHTML = `<span class="dp-text"></span>${ICON}`;
    input._dcBtn = b; input.classList.add('dp-native'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    input.after(b); sync(input);
    b.addEventListener('click', () => (cur === input ? close() : open(input)));
    b.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && e.altKey || e.key === 'ArrowDown') { e.preventDefault(); open(input); } });
    // Campos obrigatórios: a validação do formulário apontaria para um campo escondido; abre-se antes o calendário.
    input.addEventListener('invalid', e => { e.preventDefault(); b.classList.add('dp-invalid'); open(input); });
    input.addEventListener('change', () => { b.classList.remove('dp-invalid'); sync(input); });
  }
  const scan = root => { if (!fine()) return; (root.querySelectorAll ? root : document).querySelectorAll('input[type="date"]').forEach(enhance); };
  new MutationObserver(ms => { if (pop && cur && !document.contains(cur)) close(false); for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.('input[type="date"]')) enhance(n); else scan(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));
  window.CasaDatePicker = { enhance, close, label };
})();
