// v12: credit-union homepage sections (products, calculator, member ownership, learning), idle-session timeout.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const IC = {
    check: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18M7 15h3"/>', save: '<path d="M4 15c0-4 3-7 8-7s8 3 8 7-3 5-8 5-8-1-8-5z"/><path d="M12 8V5M9 12h.01"/>', card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
    car: '<path d="M5 16l1.500-5h11L19 16M3 16h18v3H3zM7 19v1M17 19v1"/>', home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>', cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
    brief: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', tool: '<path d="M14 7l3-3 3 3-3 3M3 21l9-9M12 12l-3-3 3-3 3 3z"/>', term: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>', people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.500"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.500-4 4-4"/>', coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.500 9.500h3.500a1.500 1.500 0 010 3H10a1.500 1.500 0 000 3h4"/>'
  };
  const ic = k => `<span class="ico"><svg viewBox="0 0 24 24">${IC[k]}</svg></span>`;
  const PROD = {
    Personal: [['check', 'Everyday Checking', 'No monthly fee, no minimum balance, and early access to your direct deposit.'], ['save', 'Growth Savings', 'Earn 4.35% APY with daily compounding and goals that save for you.'], ['card', 'Rewards Credit Card', '2% cash back on every purchase and no foreign transaction fees.'], ['car', 'Auto Loans', 'Competitive rates from 5.99% APR for new and used vehicles.'], ['home', 'Home Loans', 'Fixed and adjustable mortgages with local decisions and fair closing costs.'], ['cash', 'Personal Loans', 'Fast, fixed-rate loans for life\u2019s big moments, with no prepayment penalty.']],
    Business: [['brief', 'Business Checking', 'Simple pricing, free incoming wires, and tools to pay and get paid.'], ['save', 'Business Savings', 'Put idle cash to work with a high-yield account and no lock-ins.'], ['card', 'Business Credit Card', 'Employee cards, spending controls and 1.5% cash back.'], ['tool', 'Equipment Financing', 'Finance vehicles and machinery with flexible terms up to 7 years.'], ['term', 'Merchant Services', 'Accept cards in store and online with next-day funding.'], ['people', 'Payroll', 'Run payroll and tax filings with one trusted partner.']]
  };
  const ARTICLES = [['Saving', '5 habits for a stronger savings plan', '4 min read'], ['Payments', 'How ACH and wire transfers really work', '6 min read'], ['Security', 'How to spot a scam before it costs you', '5 min read']];
  const PV = {
    Auto: { rate: 5.99, min: 5000, max: 100000, step: 500, amt: 28000, terms: [36, 48, 60, 72] },
    Home: { rate: 6.25, min: 50000, max: 1000000, step: 5000, amt: 320000, terms: [180, 240, 360] },
    Personal: { rate: 8.49, min: 1000, max: 50000, step: 500, amt: 12000, terms: [12, 24, 36, 48, 60] }
  };
  const usd = n => '$' + Math.round(n).toLocaleString('en-US');
  const baseHome = window.home;
  window.home = (...a) => {
    baseHome(...a);
    const anchor = $('#locations') || $('#rates'); if (!anchor || $('#products')) return;
    const first = $('.psec.dark'); // stats band; insert products right after the markets/rates stack
    const html = `<section class="psec light" id="products"><span class="eyebrow2">Products &amp; services</span><h2>Everything you need, <em>under one roof.</em></h2><p class="lede">From your first checking account to your first home, we\u2019re here for every stage, with fair pricing and people who know your name.</p>
      <div class="ptabs" id="ptabs">${Object.keys(PROD).map((k, i) => `<button class="${i ? '' : 'on'}" data-k="${k}">${k}</button>`).join('')}</div><div class="pgrid" id="pgrid"></div></section>
      <section class="psec dark" id="own"><div class="split"><div><span class="eyebrow2">Member-owned</span><h2>Owned by you. <em>Run for you.</em></h2><p class="lede">As a credit union, we answer to our members, not to shareholders. That means fairer rates, lower fees, and decisions made close to home.</p><ul class="checks"><li>Earnings return to members through better rates and lower fees</li><li>One member, one vote on our board of directors</li><li>Local lenders who understand your community</li></ul></div>
      <div class="own-grid">${[['coin', '$0', 'Monthly maintenance fees'], ['people', '1 member, 1 vote', 'Every member has a say'], ['chart', '4.35%', 'APY on Growth Savings'], ['home', 'Local', 'Decisions made in Colorado']].map(x => `<div class="own">${ic(x[0])}<b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div></div></section>
      <section class="psec light" id="calc"><div class="split"><div><span class="eyebrow2">Loan calculator</span><h2>See your <em>monthly payment.</em></h2><p class="lede">Estimate payments before you apply. Rates shown are samples for a fictional institution.</p></div>
      <div class="pcalc"><div class="ptabs" id="lt">${Object.keys(PV).map((k, i) => `<button class="${i ? '' : 'on'}" data-k="${k}">${k}</button>`).join('')}</div><label>Loan amount</label><div class="big" id="la">$0</div><input id="lr" type="range"><label>Term</label><select id="lm"></select><div class="out"><div><label>Monthly payment</label><strong id="lp">$0</strong></div><div><label>Total interest</label><strong id="li">$0</strong></div></div><p class="mk-note" id="lrate"></p></div></div></section>
      <section class="psec" id="learn" style="background:#fff"><span class="eyebrow2">Learn</span><h2>Financial <em>know-how.</em></h2><div class="art-grid">${ARTICLES.map(a => `<article class="art"><span class="tag">${a[0]}</span><h3>${a[1]}</h3><small>${a[2]}</small></article>`).join('')}</div></section>`;
    anchor.insertAdjacentHTML('afterend', html);
    const draw = k => { $('#pgrid').innerHTML = PROD[k].map(p => `<div class="fcard">${ic(p[0])}<h3>${p[1]}</h3><p>${p[2]}</p><a class="more" onclick="login()">Learn more \u2192</a></div>`).join(''); };
    draw('Personal'); $$('#ptabs button').forEach(b => b.onclick = () => { $$('#ptabs button').forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.k); });
    let kind = 'Auto';
    const calc = () => { const c = PV[kind], P = Number($('#lr').value), n = Number($('#lm').value), r = c.rate / 100 / 12, pay = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; $('#la').textContent = usd(P); $('#lp').textContent = usd(pay); $('#li').textContent = usd(pay * n - P); $('#lrate').textContent = `Sample rate ${c.rate.toFixed(2)}% APR. Estimates only; not an offer of credit.`; };
    const setKind = k => { kind = k; const c = PV[k], rg = $('#lr'); rg.min = c.min; rg.max = c.max; rg.step = c.step; rg.value = c.amt; $('#lm').innerHTML = c.terms.map(t => `<option value="${t}" ${t === c.terms[Math.floor(c.terms.length / 2)] ? 'selected' : ''}>${t >= 24 ? (t / 12) + ' years' : t + ' months'}${t >= 24 && t % 12 ? ' (' + t + ' mo)' : ''}</option>`).join(''); calc(); };
    $$('#lt button').forEach(b => b.onclick = () => { $$('#lt button').forEach(x => x.classList.toggle('on', x === b)); setKind(b.dataset.k); });
    $('#lr').oninput = calc; $('#lm').onchange = calc; setKind('Auto');
    $$('.pnav nav, .pmobile').forEach(n => { if (!n.querySelector('[data-prod]')) n.insertAdjacentHTML('beforeend', '<a data-prod onclick="aurumGo(\'products\')">Products</a>'); });
  };
  if (location.pathname !== '/admin' && !state.user && $('.phero')) home();

  /* ---------- idle session timeout (like a real bank) ---------- */
  let last = Date.now(), warned = false, cd = null;
  const touch = () => { last = Date.now(); };
  ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(e => addEventListener(e, touch, { passive: true }));
  setInterval(() => {
    if (!state.user || warned) return;
    if (Date.now() - last > 9 * 60 * 1000) {
      warned = true; let s = 60;
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2" id="idle" style="z-index:500"><div><div class="topline"><h2>Are you still there?</h2></div><p class="muted" style="line-height:1.55">For your security, we\u2019ll sign you out in <b id="idle-s">60</b> seconds because there has been no activity.</p><div style="display:flex;gap:10px;margin-top:18px"><button class="cta" id="idle-stay" style="flex:1">Stay signed in</button><button class="secondary-button" id="idle-out">Sign out</button></div></div></div>`);
      const close = () => { clearInterval(cd); $('#idle')?.remove(); warned = false; last = Date.now(); };
      $('#idle-stay').onclick = close; $('#idle-out').onclick = () => { close(); signOut(); };
      cd = setInterval(() => { s--; const el = $('#idle-s'); if (el) el.textContent = s; if (s <= 0) { close(); signOut(); } }, 1000);
    }
  }, 5000);
}, 0);
