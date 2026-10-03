// Mountain Hills v4: cinematic marketing site, premium login, dashboard extras,
// Cards / Insights / Pay-bills pages. Loaded last.
setTimeout(() => {
  const esc = escapeText;
  const I = {
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    check: '<path d="M5 12l5 5 9-10"/>'
  };
  const icon = k => `<span class="ico"><svg viewBox="0 0 24 24">${I[k]}</svg></span>`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let obs, scrollHandler, moveHandler;

  /* ---------- effects ---------- */
  const reveal = () => {
    obs?.disconnect();
    obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); if (e.target.dataset.count) countUp(e.target); } }), { threshold: .14, rootMargin: '0px 0px -40px 0px' });
    $$('.rv,[data-count]').forEach(el => obs.observe(el));
  };
  const countUp = (el, dur = 1600) => {
    const to = parseFloat(el.dataset.count), pre = el.dataset.pre || '', suf = el.dataset.suf || '', dec = Number(el.dataset.dec || 0);
    const t0 = performance.now();
    const step = t => { const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4); el.textContent = pre + (to * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const cleanup = () => { if (scrollHandler) removeEventListener('scroll', scrollHandler); if (moveHandler) removeEventListener('mousemove', moveHandler); scrollHandler = moveHandler = null; };
  const goTo = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); $('.pmobile')?.classList.remove('open'); };
  window.aurumGo = goTo;

  /* ---------- HOME ---------- */
  const footerHTML = () => `<footer class="pfoot"><div class="cols"><div><div class="wordmark">Mountain Hills</div><p style="line-height:1.7;max-width:320px">Banking built with clarity, care, and craft. Everyday accounts, savings, and payments in one beautifully simple place.</p></div>
    <div><h5>Personal</h5><a>Everyday account</a><a>Growth savings</a><a>Debit card</a><a>Bill pay</a></div>
    <div><h5>Business</h5><a>Studio Business</a><a>Invoicing</a><a>Payroll</a><a>Cash flow</a></div>
    <div><h5>Company</h5><a>About Mountain Hills</a><a>Careers</a><a>Press</a><a>Contact</a></div>
    <div><h5>Support</h5><a>Help centre</a><a>Security</a><a>Privacy</a><a>Accessibility</a></div></div>
    <div class="legal">Mountain Hills County Credit Union is a fictional brand created for design and portfolio purposes. It is not a chartered credit union or bank, does not hold deposits, and is not federally insured. Names, balances, and rates shown are samples. \u00a9 ${new Date().getFullYear()} Mountain Hills County Credit Union.</div></footer>`;

  window.home = () => {
    cleanup();
    const first = !sessionStorage.getItem('aurum.intro');
    sessionStorage.setItem('aurum.intro', '1');
    const links = [['features', 'Features'], ['cards', 'Cards'], ['savings', 'Savings'], ['security', 'Security'], ['faq', 'FAQ']];
    app.innerHTML = `${first ? '<div class="intro"><b>Mountain Hills</b></div>' : ''}
    <header class="pnav" id="pnav"><div class="wordmark">Mountain Hills</div><nav>${links.map(l => `<a onclick="aurumGo('${l[0]}')">${l[1]}</a>`).join('')}</nav><div class="navcta"><button class="signin" onclick="login()">Sign in</button><button class="burger" aria-label="Menu" onclick="document.querySelector('.pmobile').classList.toggle('open')">\u2630</button></div></header>
    <div class="pmobile">${links.map(l => `<a onclick="aurumGo('${l[0]}')">${l[1]}</a>`).join('')}<a onclick="login()" style="color:var(--mint)">Sign in \u2192</a></div>
    <section class="phero"><div class="aurora"><i></i><i></i><i></i></div><div class="gridlines"></div><div class="grain"></div>
      <div class="hero-in"><div>
        <span class="pill rv"><i></i>New \u00b7 4.35% APY on Growth Savings</span>
        <h1 class="rv" style="--d:.1s">Banking that <em>feels</em> like it was made for you.</h1>
        <p class="sub rv" style="--d:.2s">One calm, beautiful place for your money. Send in seconds, save on autopilot, and see exactly where every dollar goes.</p>
        <div class="hero-cta rv" style="--d:.3s"><button class="btn-glow" onclick="login()">Open your account \u2192</button><button class="btn-ghost" onclick="aurumGo('features')">Explore features</button></div>
        <div class="trust rv" style="--d:.4s"><span><svg viewBox="0 0 24 24">${I.shield}</svg>Bank-grade encryption</span><span><svg viewBox="0 0 24 24">${I.lock}</svg>2-step verification</span><span><svg viewBox="0 0 24 24">${I.bolt}</svg>Instant transfers</span></div>
      </div>
      <div class="stage rv rv-z" style="--d:.2s" id="stage">
        <div class="metal" data-depth="24"><div style="display:flex;justify-content:space-between"><span class="cw">Mountain Hills</span><span style="font:11px 'DM Mono';letter-spacing:.1em">DEBIT</span></div><div class="cn">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 6310</div></div>
        <div class="phone" id="phone"><div class="screen"><small>Total balance</small><div class="bal" data-count="580970" data-pre="$" data-dec="2">$0.00</div>
          <div class="mini-chart"><svg viewBox="0 0 240 70" preserveAspectRatio="none"><defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9ff71" stop-opacity=".45"/><stop offset="1" stop-color="#d9ff71" stop-opacity="0"/></linearGradient></defs><path class="fl" d="M0 55 C30 50 45 30 75 36 S120 55 150 30 S200 14 240 8 V70 H0Z"/><path class="ln" d="M0 55 C30 50 45 30 75 36 S120 55 150 30 S200 14 240 8"/></svg></div>
          <div class="acts"><div><span>\u2191</span>Send</div><div><span>\u2193</span>Request</div><div><span>\u25a4</span>Cards</div><div><span>\u2630</span>Bills</div></div>
          <div class="tx"><div><b>Nova Studio</b><small>Design retainer</small></div><em>+$1,250.00</em></div><div class="tx"><div><b>Whole Foods</b><small>Groceries</small></div><span>\u2212$84.20</span></div><div class="tx"><div><b>Growth Savings</b><small>Interest paid</small></div><em>+$312.44</em></div></div></div>
        <div class="floatcard fc1" data-depth="34"><small>This month</small><b>+$4,820.00</b></div>
        <div class="floatcard fc2" data-depth="40"><small>Savings goal \u00b7 Home</small><b>78% funded</b></div>
        <div class="floatcard fc3" data-depth="28"><small>Transfer sent</small><b>\u2713 Instantly</b></div>
      </div></div><div class="scrollcue"></div></section>
    <div class="ticker"><div>${Array(2).fill(['Instant transfers', 'No monthly fees', '4.35% APY savings', 'Virtual cards in seconds', '24/7 human support', 'Real-time alerts', 'Smart spending insights'].map(t => `<span>${t}</span>`).join('')).join('')}</div></div>
    <section class="psec dark" style="padding-top:90px;padding-bottom:90px"><div class="stats rv"><div><strong data-count="2.4" data-suf="M" data-dec="1">0</strong><span>Customers trust Mountain Hills</span></div><div><strong data-count="48" data-pre="$" data-suf="B" >0</strong><span>Moved every year</span></div><div><strong data-count="4.9" data-dec="1" data-suf="\u2605">0</strong><span>Average app rating</span></div><div><strong data-count="99.99" data-dec="2" data-suf="%">0</strong><span>Platform uptime</span></div></div></section>
    <section class="psec light" id="features"><span class="eyebrow2 rv">Everything you need</span><h2 class="rv">A bank with <em>nothing</em> in the way.</h2><p class="lede rv">Every feature is designed to remove friction, so managing money feels less like a chore and more like a habit you actually enjoy.</p>
      <div class="fgrid">${[['bolt', 'Instant transfers', 'Send money to anyone, any time. Clear confirmation, live status, and a receipt you can trust.'], ['card', 'Virtual & physical cards', 'Create a card in seconds, freeze it in one tap, and set limits that suit you.'], ['chart', 'Spending insights', 'Beautiful breakdowns that show where your money goes, without spreadsheets.'], ['bell', 'Real-time alerts', 'Know the moment money moves. Choose exactly which alerts you want.'], ['globe', 'Bill pay', 'Pay utilities, phone, insurance and more from one place, on your schedule.'], ['shield', 'Built-in protection', 'Continuous fraud monitoring and instant card lock keep your money safe.']].map((f, i) => `<div class="fcard rv" style="--d:${(i % 3) * .1}s">${icon(f[0])}<h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
    <section class="psec dark" id="cards"><div class="split"><div><span class="eyebrow2 rv">Mountain Hills cards</span><h2 class="rv">Carry it <em>beautifully.</em></h2><p class="lede rv">Metal-finish cards with zero foreign transaction fees, cashback on everyday spend, and controls that live in your pocket.</p>
      <div class="cardtabs rv" id="ctabs"><button class="on" data-c="0">Debit</button><button data-c="1">Everyday Credit</button><button data-c="2">Business</button></div>
      <ul class="checks rv"><li>Freeze and unfreeze instantly from the app</li><li>No annual fee, no foreign transaction fees</li><li>Add to Apple Pay and Google Pay in one tap</li></ul></div>
      <div class="cardstage rv rv-r"><div class="bigcard c0" id="bigcard"><div class="row1"><b style="font-size:24px;letter-spacing:-1px">Mountain Hills</b><span id="ctype" style="font:12px 'DM Mono';letter-spacing:.14em">DEBIT</span></div><div class="chipx"></div><div><div class="cn">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 6310</div><div class="row3" style="margin-top:14px"><span>MOUNTAIN HILLS COUNTY</span><span>09/29</span></div></div></div></div></div></section>
    <section class="psec light"><span class="eyebrow2 rv">How it works</span><h2 class="rv">Up and running in <em>minutes.</em></h2>
      <div class="steps">${[['Create your profile', 'Tell us a little about you. No branch visits, no paperwork piles.'], ['Fund your account', 'Move money in by transfer or direct deposit and watch it arrive.'], ['Live your life', 'Spend, save, and send with insight and control at every step.']].map((s, i) => `<div class="step rv" style="--d:${i * .12}s"><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}</div></section>
    <section class="psec dark" id="savings"><div class="split"><div><span class="eyebrow2 rv">Growth Savings</span><h2 class="rv">Let your money <em>work.</em></h2><p class="lede rv">Earn 4.35% APY with no minimums and no lock-ins. See what your savings could become.</p><ul class="checks rv"><li>Interest compounds daily, paid monthly</li><li>Round-ups and goals that save automatically</li><li>Withdraw any time, no penalties</li></ul></div>
      <div class="calc rv rv-r"><label>Starting deposit</label><div class="big" id="cdep">$25,000</div><input id="crange" type="range" min="1000" max="500000" step="1000" value="25000"><label>Monthly contribution</label><div class="big" id="cmon" style="font-size:30px">$500</div><input id="crange2" type="range" min="0" max="5000" step="50" value="500">
        <div class="out"><div><label>Balance in 5 years</label><strong id="c5">$0</strong></div><div class="hl"><label>Interest earned</label><strong id="ci">$0</strong></div></div><svg id="cchart" viewBox="0 0 300 120" preserveAspectRatio="none"></svg></div></div></section>
    <section class="psec light" id="security"><div class="split"><div><span class="eyebrow2 rv">Security</span><h2 class="rv">Protected at <em>every</em> layer.</h2><p class="lede rv">Your trust is the whole point. Mountain Hills is built with defence in depth, from the login screen to the ledger.</p><ul class="checks rv"><li>256-bit encryption for data in transit and at rest</li><li>Two-step verification on every transfer</li><li>Real-time fraud monitoring, around the clock</li><li>Instant card freeze and device management</li></ul></div>
      <div class="rv rv-r" style="display:grid;gap:14px">${[['lock', 'Two-step approval', 'Every transfer is confirmed with a one-time code sent to your device.'], ['shield', 'Fraud shield', 'Unusual activity is flagged and reviewed within seconds.'], ['bell', 'Instant alerts', 'Push, SMS and email the moment your account moves.']].map(x => `<div class="fcard" style="display:flex;gap:18px;align-items:flex-start">${icon(x[0])}<div><h3 style="margin-top:2px">${x[1]}</h3><p>${x[2]}</p></div></div>`).join('')}</div></div></section>
    <section class="psec dark"><span class="eyebrow2 rv">Loved by customers</span><h2 class="rv">People <em>actually</em> like their bank.</h2>
      <div class="quotes">${[['Switching took ten minutes. Sending money now feels effortless, and the receipts look better than my old bank\u2019s statements.', 'Amara O.', 'Product designer'], ['The spending insights changed how I budget. I finally know where my money goes each month.', 'Daniel R.', 'Founder, Studio North'], ['Card freeze saved me on a trip. One tap and I could relax. That\u2019s what good banking should feel like.', 'Priya S.', 'Consultant']].map((q, i) => `<div class="quote rv" style="--d:${i * .12}s"><div class="stars">\u2605\u2605\u2605\u2605\u2605</div><p>\u201c${q[0]}\u201d</p><div class="who"><span class="av">${q[1][0]}</span><div><b>${q[1]}</b><small>${q[2]}</small></div></div></div>`).join('')}</div></section>
    <section class="psec light" id="faq"><div style="text-align:center"><span class="eyebrow2 rv">Questions</span><h2 class="rv" style="margin-left:auto;margin-right:auto">Good to <em>know.</em></h2></div>
      <div class="faq rv">${[['Are there any monthly fees?', 'No. Everyday and Growth Savings accounts have no monthly fees, no minimum balance, and no overdraft fees.'], ['How fast are transfers?', 'Transfers between Mountain Hills accounts are instant. Transfers to other banks typically arrive the same business day.'], ['Is my money safe?', 'Mountain Hills uses bank-grade encryption, two-step approval on every transfer, and continuous fraud monitoring.'], ['Can I freeze my card?', 'Yes. Open Cards in your dashboard and toggle Freeze. It takes effect immediately and can be reversed any time.'], ['Is this a real bank?', 'No. Mountain Hills County Credit Union is a fictional brand built to show design and engineering work. No real money is held or moved.']].map(f => `<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('')}</div></section>
    <div class="cta-band rv rv-z"><h2>Your money, <span class="serif">finally</span> at ease.</h2><p>Join millions who bank the calm way. It takes about five minutes.</p><button class="btn-glow" onclick="login()">Get started \u2192</button></div>
    ${footerHTML()}`;
    window.scrollTo(0, 0);
    reveal();
    // nav solid on scroll
    const nav = $('#pnav'); scrollHandler = () => nav?.classList.toggle('solid', scrollY > 40); scrollHandler(); addEventListener('scroll', scrollHandler, { passive: true });
    // hero parallax
    const phone = $('#phone'), stage = $('#stage');
    if (matchMedia('(pointer:fine)').matches && stage) {
      moveHandler = e => { const r = stage.getBoundingClientRect(); if (r.bottom < 0) return; const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5); phone.style.transform = `rotateY(${-14 + x * 12}deg) rotateX(${6 - y * 10}deg) rotateZ(2deg)`; $$('[data-depth]', stage).forEach(el => { const d = Number(el.dataset.depth); el.style.transform = `translate(${x * d}px,${y * d}px)`; }); };
      addEventListener('mousemove', moveHandler);
    }
    // feature card spotlight
    $$('.fcard').forEach(c => c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));
    // card tabs + tilt
    const bc = $('#bigcard'), names = ['DEBIT', 'CREDIT', 'BUSINESS'];
    $$('#ctabs button').forEach(b => b.onclick = () => { $$('#ctabs button').forEach(x => x.classList.toggle('on', x === b)); bc.className = 'bigcard c' + b.dataset.c; $('#ctype').textContent = names[b.dataset.c]; });
    if (bc && matchMedia('(pointer:fine)').matches) { const st = bc.parentElement; st.addEventListener('mousemove', e => { const r = st.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; bc.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg)`; }); st.addEventListener('mouseleave', () => bc.style.transform = ''); }
    // savings calculator
    const r1 = $('#crange'), r2 = $('#crange2'), fmt = n => '$' + Math.round(n).toLocaleString('en-US');
    const calc = () => { const p = +r1.value, m = +r2.value, rate = .0435 / 12; let b = p, pts = [b]; for (let i = 1; i <= 60; i++) { b = b * (1 + rate) + m; if (i % 6 === 0) pts.push(b); } const contributed = p + m * 60; $('#cdep').textContent = fmt(p); $('#cmon').textContent = fmt(m); $('#c5').textContent = fmt(b); $('#ci').textContent = fmt(b - contributed); const mx = Math.max(...pts), path = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 300} ${112 - (v / mx) * 100}`).join(' '); $('#cchart').innerHTML = `<defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9ff71" stop-opacity=".4"/><stop offset="1" stop-color="#d9ff71" stop-opacity="0"/></linearGradient></defs><path d="${path} L300 120 L0 120Z" fill="url(#cg)"/><path d="${path}" fill="none" stroke="#d9ff71" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`; };
    r1.oninput = r2.oninput = calc; calc();
  };

  /* ---------- LOGIN ---------- */
  window.login = () => {
    cleanup();
    const demo = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    app.innerHTML = `<main class="lgn page-enter"><section class="lgn-art"><div class="aurora"><i></i><i></i><i></i></div><div class="gridlines"></div><div class="grain"></div><div class="wordmark" style="color:#fff;position:relative">Mountain Hills</div>
      <div><span class="pill" style="position:relative;margin-bottom:22px"><i></i>Secure customer access</span><h1>Welcome back to <em>your world.</em></h1><p>Sign in to see your accounts, send money, and pay bills, all in one calm place.</p><ul class="checks" style="margin-top:28px"><li>Two-step approval on every transfer</li><li>Instant card freeze and alerts</li></ul></div>
      <button class="back-link" style="color:#a8c2be;position:relative" onclick="home()">\u2190 Back to homepage</button></section>
      <section class="lgn-form"><div class="lgn-card"><span class="kicker" style="color:#55737b">Secure sign in</span><h2>Good to see you.</h2><p class="muted">Enter your email address and password to continue.</p>
      <form id="login-form"><div class="form-field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" ${demo ? 'value="amara@aurumsim.test"' : ''} required></div><div class="form-field"><label for="password">Password</label><div class="pwrap"><input id="password" name="password" type="password" autocomplete="current-password" ${demo ? 'value="demo1234"' : ''} required><button type="button" id="pwt">Show</button></div></div><button class="cta">Sign in <span></span></button></form>
      <p class="form-note">\ud83d\udd12 Protected with 256-bit encryption and continuous fraud monitoring.</p></div></section></main>`;
    window.scrollTo(0, 0);
    $('#login-form').onsubmit = signIn;
    $('#pwt').onclick = e => { const p = $('#password'); p.type = p.type === 'password' ? 'text' : 'password'; e.target.textContent = p.type === 'password' ? 'Show' : 'Hide'; };
  };

  /* ---------- DASHBOARD EXTRAS ---------- */
  const COLORS = ['#15555a', '#d9ff71', '#e9c46a', '#7ee0d0', '#e76f51', '#8ab6f9'];
  const cat = t => { const s = `${t.recipient_name} ${t.description}`.toLowerCase(); if (/bill payment|verizon|at&t|comcast|xfinity|con ?ed|edison|electric|water|internet|phone|insurance|state farm|geico/.test(s)) return 'Bills & utilities'; if (/rent|mortgage|landlord|housing/.test(s)) return 'Housing'; if (/uber|lyft|fuel|gas station|transit|airline|flight/.test(s)) return 'Transport'; if (/netflix|spotify|subscription|hulu|disney|apple|google/.test(s)) return 'Subscriptions'; if (/grocer|food|restaurant|cafe|market|dinner|lunch|whole foods|walmart|target/.test(s)) return 'Food & shopping'; return 'Transfers'; };
  const outgoing = () => (state.data?.transactions || []).filter(t => t.status === 'COMPLETED');
  const groupCats = txs => { const m = {}; txs.forEach(t => { const c = cat(t); m[c] = (m[c] || 0) + Number(t.amount); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const donut = (entries) => { const total = entries.reduce((s, e) => s + e[1], 0) || 1; let off = 0; const C = 2 * Math.PI * 54; const rings = entries.map((e, i) => { const len = (e[1] / total) * C; const el = `<circle cx="75" cy="75" r="54" stroke="${COLORS[i % COLORS.length]}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`; off += len; return el; }).join(''); return `<div class="donutwrap"><svg class="donut" viewBox="0 0 150 150"><circle cx="75" cy="75" r="54" stroke="#eef3f0"/>${rings}<text x="75" y="72" text-anchor="middle" font-size="11" fill="#688087" font-family="Manrope">Total out</text><text x="75" y="92" text-anchor="middle" font-size="16" font-weight="700" fill="#102a32" font-family="Manrope">${money(total).replace('.00', '')}</text></svg><div class="legend">${entries.map((e, i) => `<div><b style="font-weight:500"><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(e[0])}</b><span>${money(e[1])}</span></div>`).join('') || '<span>No spending yet.</span>'}</div></div>`; };
  const weekBars = txs => { const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; }); const vals = days.map(d => txs.filter(t => { const x = new Date(t.created_at); x.setHours(0, 0, 0, 0); return +x === +d; }).reduce((s, t) => s + Number(t.amount), 0)); const mx = Math.max(...vals, 1); return `<div class="bars">${vals.map((v, i) => `<div style="height:${Math.max(4, v / mx * 100)}%;animation-delay:${i * .06}s" data-v="${money(v)}"></div>`).join('')}</div><div class="barlab">${days.map(d => `<span>${d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>`).join('')}</div>`; };
  const AV = ['#d9ff71', '#7ee0d0', '#e9c46a', '#f4a58f', '#a9c4f5'];
  window.prefillTransfer = async (name, acctNo, bank) => {
    await openTransfer();
    const set = (n, v) => { const el = document.querySelector(`#xf-form [name="${n}"]`); if (el) el.value = v || ''; };
    set('recipientName', name); set('recipientAccount', acctNo); set('recipientBank', bank);
    document.querySelector('#xf-amount')?.focus();
  };

  const baseDashboard = dashboard;
  dashboard = async (...a) => {
    await baseDashboard(...a);
    const hero = $('.balance-hero'); if (!hero || !state.data) return;
    // count-up + actions
    const strong = $('strong', hero); const val = Number(state.account.available_balance);
    if (strong) { strong.dataset.count = val; strong.dataset.pre = '$'; strong.dataset.dec = 2; countUp(strong, 1300); }
    hero.insertAdjacentHTML('beforeend', `<div class="bh-actions"><button class="pri" onclick="openTransfer()">\u2191 Send money</button><button onclick="customerBills()">Pay bills</button><button onclick="customerCards()">Cards</button><button onclick="customerInsights()">Insights</button></div>`);
    const txs = outgoing(); const recents = []; const seen = new Set();
    (state.data.transactions || []).forEach(t => { if (!seen.has(t.recipient_account) && !/^bill/i.test(t.description || '') && recents.length < 8) { seen.add(t.recipient_account); recents.push(t); } });
    const people = `<section class="surface" style="margin-top:20px"><div class="surface-head"><h2>Send again</h2></div><div class="people"><button class="person add" onclick="openTransfer()"><span>+</span><small>New</small></button>${recents.map((t, i) => `<button class="person" onclick="prefillTransfer('${esc(t.recipient_name).replace(/'/g, '&#39;')}','${esc(t.recipient_account)}','${esc(t.recipient_bank).replace(/'/g, '&#39;')}')"><span style="background:${AV[i % AV.length]}">${esc(t.recipient_name[0])}</span><small>${esc(t.recipient_name.split(' ')[0])}</small></button>`).join('')}</div></section>`;
    const extras = `${people}<div class="dx"><article class="surface"><div class="surface-head"><h2>Where your money goes</h2><button class="text-button" onclick="customerInsights()">Details</button></div>${donut(groupCats(txs))}</article><article class="surface"><div class="surface-head"><h2>Last 7 days</h2></div>${weekBars(txs)}</article></div>`;
    $('.content-grid')?.insertAdjacentHTML('afterend', extras);
  };

  /* ---------- CARDS ---------- */
  const cardState = () => JSON.parse(localStorage.getItem('aurum.card') || '{"frozen":false,"online":true,"intl":true,"contactless":true}');
  const saveCard = c => localStorage.setItem('aurum.card', JSON.stringify(c));
  window.customerCards = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      const c = cardState(), a = state.account || state.data.accounts[0], last4 = String(a.account_number).slice(-4), name = state.user.name.toUpperCase();
      const sw = (k, t, s) => `<div class="sw"><div><b>${t}</b><small>${s}</small></div><button class="tg ${c[k] ? 'on' : ''}" data-k="${k}" aria-label="${t}"></button></div>`;
      app.innerHTML = window.__shell('cards', `<header class="dash-head"><div><span class="kicker muted-kicker">Your cards</span><h1>Cards</h1></div></header>
        <section class="surface"><div class="vcard-wrap"><div><div class="vcard ${c.frozen ? 'frozen' : ''}" id="vc"><div class="r"><b style="font-size:22px;letter-spacing:-1px">Mountain Hills</b><span style="font:11px 'DM Mono';letter-spacing:.14em">DEBIT</span></div><div class="chipx" style="width:44px;height:32px;border-radius:7px;background:linear-gradient(135deg,#d7bb68,#fff3b8)"></div><div><div class="cn" id="vcn">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}</div><div class="r3" style="margin-top:12px"><span>${esc(name)}</span><span>09/29</span></div></div></div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="secondary-button" id="reveal">Show details</button><button class="secondary-button" onclick="toast('Added to Apple Wallet (demo).')">Add to Wallet</button></div></div>
        <div class="cctl">${sw('frozen', 'Freeze card', 'Instantly block all card spending')}${sw('online', 'Online payments', 'Allow purchases on websites and apps')}${sw('intl', 'International use', 'Allow spending outside the U.S.')}${sw('contactless', 'Contactless', 'Tap to pay at terminals')}</div></div></section>
        <section class="surface" style="margin-top:20px"><div class="surface-head"><h2>Spending limits</h2></div><div class="mini-list" style="border:0;margin:0"><div><b>Daily card limit</b><span>$10,000.00</span></div><div><b>Daily ATM withdrawal</b><span>$1,000.00</span></div><div><b>Per-purchase limit</b><span>$25,000.00</span></div></div></section>`);
      $$('.tg').forEach(b => b.onclick = () => { const cs = cardState(); cs[b.dataset.k] = !cs[b.dataset.k]; saveCard(cs); b.classList.toggle('on', cs[b.dataset.k]); if (b.dataset.k === 'frozen') $('#vc').classList.toggle('frozen', cs.frozen); toast(b.dataset.k === 'frozen' ? (cs.frozen ? 'Card frozen. Spending is blocked.' : 'Card unfrozen.') : 'Card setting saved.'); });
      let shown = false; $('#reveal').onclick = e => { shown = !shown; $('#vcn').textContent = shown ? `4532 8891 2204 ${last4}` : `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}`; e.target.textContent = shown ? 'Hide details' : 'Show details'; };
    } catch (e) { toast(e.message); }
  };

  /* ---------- INSIGHTS ---------- */
  window.customerInsights = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      const txs = outgoing(), total = txs.reduce((s, t) => s + Number(t.amount), 0), big = txs.reduce((m, t) => Math.max(m, Number(t.amount)), 0);
      const byR = {}; txs.forEach(t => byR[t.recipient_name] = (byR[t.recipient_name] || 0) + Number(t.amount)); const top = Object.entries(byR).sort((a, b) => b[1] - a[1]).slice(0, 5);
      app.innerHTML = window.__shell('insights', `<header class="dash-head"><div><span class="kicker muted-kicker">Understand your money</span><h1>Insights</h1></div></header>
        <div class="kpis"><div class="kpi"><small>Total sent</small><strong>${money(total)}</strong></div><div class="kpi"><small>Transactions</small><strong>${txs.length}</strong></div><div class="kpi"><small>Average</small><strong>${money(txs.length ? total / txs.length : 0)}</strong></div><div class="kpi"><small>Largest</small><strong>${money(big)}</strong></div></div>
        <div class="dx" style="margin-top:0"><article class="surface"><div class="surface-head"><h2>By category</h2></div>${donut(groupCats(txs))}</article><article class="surface"><div class="surface-head"><h2>Last 7 days</h2></div>${weekBars(txs)}</article></div>
        <section class="surface" style="margin-top:20px"><div class="surface-head"><h2>Top recipients</h2></div>${top.map((r, i) => `<div class="txn-v2"><div class="txn-title"><span class="txn-icon" style="background:${AV[i % 5]}55;font-weight:700">${esc(r[0][0])}</span><b>${esc(r[0])}</b></div><b>${money(r[1])}</b></div>`).join('') || '<p class="muted">Send some money to see your top recipients.</p>'}</section>`);
    } catch (e) { toast(e.message); }
  };

  /* ---------- BILL PAY ---------- */
  const PAYEES = [['Con Edison', 'Electric', '#2f7d4f', 142.6, '3 days'], ['Verizon Wireless', 'Mobile', '#cd2026', 89.99, '5 days'], ['Comcast Xfinity', 'Internet', '#6b3fa0', 79.99, '9 days'], ['State Farm', 'Insurance', '#d62b2b', 214.35, '12 days'], ['NYC Water Board', 'Water', '#2b7bd6', 56.4, '14 days'], ['Netflix', 'Subscription', '#b31217', 15.49, 'Paid']];
  window.customerBills = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      app.innerHTML = window.__shell('bills', `<header class="dash-head"><div><span class="kicker muted-kicker">Bill pay</span><h1>Pay bills</h1></div></header><section class="surface"><div class="surface-head"><div><h2>Your payees</h2><p class="muted">Payments are debited instantly and appear in your activity with a receipt.</p></div></div><div class="payees">${PAYEES.map((p, i) => `<button class="payee" data-i="${i}"><div class="lg" style="background:${p[2]}">${p[0][0]}</div><b>${p[0]}</b><small>${p[1]}</small><br><span class="due ${p[4] === 'Paid' ? 'ok' : ''}">${p[4] === 'Paid' ? 'Paid this month' : 'Due in ' + p[4]}</span></button>`).join('')}</div></section>`);
      $$('.payee').forEach(b => b.onclick = () => payBill(Number(b.dataset.i)));
    } catch (e) { toast(e.message); }
  };
  const payBill = i => {
    const p = PAYEES[i], accts = state.data.accounts.filter(a => !a.status || a.status === 'ACTIVE');
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2"><div><div class="topline"><h2>Pay ${esc(p[0])}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div><form id="bill-form"><div class="form-field"><label>Pay from</label><select name="accountId">${accts.map(a => `<option value="${a.id}" ${a.id === state.account?.id ? 'selected' : ''}>${esc(a.name)} \u00b7 ${money(a.available_balance)}</option>`).join('')}</select></div><div class="form-field"><label>Amount (USD)</label><input name="amount" type="number" step="0.01" min="0.01" value="${p[3]}" required></div><div class="form-field"><label>Account / reference no.</label><input name="ref" value="${String(4000000 + i * 137291).slice(0, 8)}" required></div><button class="cta modal-submit" style="width:100%">Pay ${esc(p[0])}</button></form></div></div>`);
    $('#bill-form').onsubmit = async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = $('button', e.target); btn.disabled = true; btn.textContent = 'Processing\u2026';
      try {
        const r = await api('/api/customer/transfers', { method: 'POST', body: JSON.stringify({ accountId: Number(f.accountId), recipientName: p[0], recipientAccount: f.ref, recipientBank: p[0] + ' (Biller)', amount: Number(f.amount), description: 'Bill payment \u2013 ' + p[1] }) });
        closeModal(); state.data = await api('/api/customer/dashboard'); toast(`${p[0]} paid. Reference ${r.reference}`); customerBills();
      } catch (err) { btn.disabled = false; btn.textContent = 'Pay ' + p[0]; toast(err.message); }
    };
  };

  // Re-render the entry page with the new marketing site (skip when already signed in / admin)
  if (location.pathname !== '/admin' && !state.user) home();
}, 0);
