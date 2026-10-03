// v15: smooth loading, cinematic page motion, clean quick actions, touch feel.
// Runs last on purpose. It only adds to the page after each view is drawn,
// so none of the older files had to change.
setTimeout(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const appEl = document.querySelector('#app');
  if (!appEl) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Loading bar at the top (shows while the server answers) ---------- */
  const bar = document.createElement('div');
  bar.id = 'nprog';
  document.body.appendChild(bar);
  let inflight = 0, showT = 0, hideT = 0;
  const barStart = () => {
    clearTimeout(hideT);
    if (inflight++ > 0) return;
    // wait a moment so very quick requests do not flash the bar
    showT = setTimeout(() => { bar.className = ''; void bar.offsetWidth; bar.className = 'on'; }, 160);
  };
  const barStop = () => {
    inflight = Math.max(0, inflight - 1);
    if (inflight > 0) return;
    clearTimeout(showT);
    if (bar.className === 'on') { bar.className = 'done'; hideT = setTimeout(() => { bar.className = ''; }, 700); }
  };
  const rawFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/\/api\//.test(url)) return rawFetch(input, init);
    barStart();
    return rawFetch(input, init).finally(barStop);
  };

  /* ---------- 2. Quick action tiles on the balance card ---------- */
  const ICONS = {
    send: '<path d="M7 17L17 7M8 7h9v9"/>',
    bills: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    cards: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/>'
  };
  const ACTIONS = [
    ['send', 'Send money', 'openTransfer()', 'p', ''],
    ['bills', 'Pay bills', 'customerBills()', '', ''],
    ['cards', 'Cards', 'customerCards()', '', ''],
    ['globe', 'Send abroad', 'openIntl()', '', ' id="abroad"']
  ];
  const buildActions = main => {
    const acts = $('.tot .acts', main);
    if (!acts || acts.dataset.v15) return;
    acts.dataset.v15 = '1';
    acts.innerHTML = ACTIONS.map(a => `<button type="button" class="${a[3]}" onclick="${a[2]}"${a[4]}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[a[0]]}</svg><span>${a[1]}</span></button>`).join('');
  };

  /* ---------- 3. Money numbers count up ---------- */
  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const countUp = el => {
    const m = el.textContent.trim().match(/^(-?)\$([\d,]+\.\d{2})$/);
    if (!m) return;
    const to = (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, '')), t0 = performance.now(), D = 900;
    const step = now => {
      const p = Math.min((now - t0) / D, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
    };
    requestAnimationFrame(step);
  };

  /* ---------- 4. Staggered entrance ---------- */
  const SEL_ALL = '.dv-top,.dv-hero>*,.tiles .tile,.dv-cols article,.dv-cols .tip,.dash-head,.page>section,.page>article,.page>div:not(.dv),.lgn-art>*,.lgn-card>*,.card2 .tx,.gmini,.upc';
  const SEL_SWITCH = '.acctcard,.dv-cols article,.dv-cols .tip,.card2 .tx,.gmini,.upc';
  const stagger = (main, switching) => {
    if (reduce) return;
    let i = 0;
    const seen = new Set();
    $$(switching ? SEL_SWITCH : SEL_ALL, main).forEach(el => {
      if (seen.has(el) || el.classList.contains('rv')) return; // 'rv' is the public homepage's own reveal
      seen.add(el);
      if (switching && el.classList.contains('acctcard')) { el.classList.add('mh-swap'); return; }
      el.classList.add('mh-in');
      el.style.setProperty('--mi', Math.min(i++, 14));
    });
  };

  /* ---------- 5. Curtain when signing in or out ---------- */
  const curtain = kind => {
    if (reduce) return;
    $('#curtain') && $('#curtain').remove();
    const first = String((typeof state !== 'undefined' && state.user && state.user.name) || '').split(' ')[0];
    const c = document.createElement('div');
    c.id = 'curtain';
    c.innerHTML = '<div class="cm"><img src="/logo.svg" alt="" width="76" height="76"><b></b><small>County Credit Union</small></div>';
    $('b', c).textContent = kind === 'app' ? (first ? 'Welcome back, ' + first : 'Welcome back') : 'See you soon';
    document.body.appendChild(c);
    document.body.classList.add('curtain-on');
    setTimeout(() => { c.remove(); document.body.classList.remove('curtain-on'); }, 1500);
  };

  /* ---------- 6. Legal strip becomes a gentle ticker so it is never cut off ---------- */
  const tick = () => {
    const span = $('.fict span');
    if (!span || span.dataset.v15) return;
    span.dataset.v15 = '1';
    const t = span.textContent;
    span.innerHTML = '<b class="mq"><i></i><i aria-hidden="true"></i></b>';
    $$('i', span).forEach(i => { i.textContent = t; });
  };

  /* ---------- 7. Watch every screen change ---------- */
  let prevKind = null, prevSig = '', userNavAt = -9999, switchMode = false;
  const meta = $('meta[name="theme-color"]');
  const obs = new MutationObserver(() => {
    const main = appEl.firstElementChild;
    if (!main) return;
    const kind = main.classList.contains('shell2') ? 'app' : 'public';
    const h1 = $('h1', main);
    const sig = ((h1 && h1.textContent) || main.className).trim().slice(0, 60);
    const recent = performance.now() - userNavAt < 4000;
    const fresh = recent || sig !== prevSig || kind !== prevKind;
    const switching = switchMode && recent && kind === prevKind && !!$('.dv', main);

    if (prevKind && kind !== prevKind) curtain(kind);

    if (!fresh) {
      main.classList.add('no-anim'); // background refresh, keep it perfectly still
    } else {
      stagger(main, switching);
      if (!reduce) {
        if (switching) $$('.acctcard .bal', main).forEach(countUp);
        else $$('.acctcard .bal,.tile strong', main).forEach(countUp);
      }
    }
    buildActions(main);
    tick();
    if (meta) meta.setAttribute('content', kind === 'app' ? '#f2f5f1' : '#0c2f2c');
    prevKind = kind; prevSig = sig; switchMode = false;
  });
  obs.observe(appEl, { childList: true });

  // the first screen may already be drawn
  if (appEl.firstElementChild) {
    const m = appEl.firstElementChild;
    prevKind = m.classList.contains('shell2') ? 'app' : 'public';
    const h = $('h1', m);
    prevSig = ((h && h.textContent) || m.className).trim().slice(0, 60);
    buildActions(m);
  }
  tick();

  /* ---------- 8. Tap a menu item: the page reacts at once ---------- */
  const NAV = new Set(['dashboard', 'transactions', 'customerBills', 'customerCards', 'customerDetails', 'customerStatements', 'customerGoals', 'customerInsights', 'customerSupport', 'customerNotifications', 'customerProfile', 'adminDashboard', 'adminCustomers', 'adminAccounts', 'adminTransactions', 'adminTransferControl', 'adminSupport', 'adminNotifications', 'adminAdministrators', 'adminAudit', 'adminProfile', 'switchAccount']);
  document.addEventListener('click', e => {
    const t = e.target.closest('[onclick]');
    if (!t) return;
    const hit = (t.getAttribute('onclick') || '').split(';').map(s => s.trim()).map(s => (s.match(/^([A-Za-z]\w*)\s*\(/) || [])[1]).find(n => n && NAV.has(n));
    if (!hit) return;
    userNavAt = performance.now();
    if (hit === 'switchAccount') {
      switchMode = true;
      const dv = $('.dv');
      dv && dv.classList.add('is-swapping');
    } else {
      switchMode = false;
      const page = $('.page');
      if (page) { page.classList.add('is-leaving'); setTimeout(() => page.classList.remove('is-leaving'), 2500); }
    }
  }, true);
  // sign in / sign out / homepage buttons also count as a deliberate move
  document.addEventListener('submit', () => { userNavAt = performance.now(); }, true);
  document.addEventListener('click', e => {
    if (e.target.closest('.sm-out,.sb-user button,.back-link,.signin,.btn-glow')) userNavAt = performance.now();
  }, true);

  /* ---------- 9. Ripple and a tiny buzz on supported phones ---------- */
  const RIP = '.cta,.tf-cta,.tile,.tabbar button,.tot .acts button,.sm-g button,.signin,.btn-glow,.btn-ghost';
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest(RIP);
    if (!b || b.disabled) return;
    if (navigator.vibrate) { try { navigator.vibrate(6); } catch (_) { /* not supported */ } }
    if (reduce) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
    const d = document.createElement('var');
    d.className = 'rip';
    d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }, { passive: true });
}, 40);
