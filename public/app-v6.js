// v6: redesigned customer dashboard + cinematic transfer flow (U.S. banks, ACH-style).
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mask = n => `\u2022\u2022\u2022\u2022 ${String(n || '').slice(-4)}`;
  const AV = ['#cde8a4', '#9fd8cc', '#f1d38a', '#f4b3a3', '#b7cdf5', '#d9c2f0'];
  const avColor = s => AV[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  const ICON = {
    CURRENT: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18"/>',
    SAVINGS: '<path d="M4 15c0-4 3-7 8-7s8 3 8 7-3 5-8 5-8-1-8-5z"/><path d="M12 8V5M9 12h.01"/>',
    BUSINESS: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3"/>'
  };
  const BANKS = [['Mountain Hills County Credit Union', '#1b5a52'], ['JPMorgan Chase', '#117aca'], ['Bank of America', '#c8102e'], ['Wells Fargo', '#b3282d'], ['Citibank', '#0a5ea8'], ['U.S. Bank', '#0c2074'], ['PNC Bank', '#f58025'], ['Truist', '#5b2a86'], ['Capital One', '#c41230'], ['TD Bank', '#2f9e44'], ['Goldman Sachs Marcus', '#5d7ea6'], ['Ally Bank', '#6c2a8d'], ['Charles Schwab Bank', '#0097d7'], ['Fifth Third Bank', '#1c6b3a'], ['KeyBank', '#b7202e'], ['Regions Bank', '#4b9b3a'], ['Citizens Bank', '#0c8c6a'], ['M&T Bank', '#0a7a4c'], ['Huntington Bank', '#3c8f3c'], ['BMO Bank', '#0079c1'], ['American Express National Bank', '#2e77bb'], ['Discover Bank', '#f76f20'], ['Navy Federal Credit Union', '#0f3b6c'], ['USAA', '#0a3a5a'], ['SoFi Bank', '#00a0dc'], ['Chime', '#1ec677'], ['Santander Bank', '#ec0000'], ['HSBC Bank USA', '#db0011'], ['First Citizens Bank', '#0b4c8c'], ['Morgan Stanley Private Bank', '#1a4b8c'], ['Synchrony Bank', '#e5a400'], ['Bank of the West', '#c8102e'], ['Zions Bancorporation', '#0f6ba8'], ['Comerica Bank', '#0a4b7c'], ['Flagstar Bank', '#7ab648'], ['Ameriprise Bank', '#0b6aa2'], ['Apple Savings by Goldman Sachs', '#555555'], ['BBVA USA', '#004481'], ['BNY Mellon', '#e2231a'], ['Bank OZK', '#00518f'], ['BankUnited', '#00467f'], ['Banner Bank', '#00a54f'], ['Cathay Bank', '#b1202d'], ['Cadence Bank', '#00a3e0'], ['Axos Bank', '#1c75bc'], ['Barclays US', '#00aeef'], ['Citizens Equity First CU', '#2c6e49'], ['City National Bank', '#006747'], ['Columbia Bank', '#0071ce'], ['Credit One Bank', '#e03a3e'], ['East West Bank', '#003a70'], ['First Horizon Bank', '#e4002b'], ['First National Bank', '#004a8f'], ['Frost Bank', '#00a3e0'], ['Hancock Whitney', '#0053a0'], ['Fidelity Bank', '#4b8b3b'], ['IBC Bank', '#d62d20'], ['Old National Bank', '#2c5aa0'], ['Pacific Premier Bank', '#006ba6'], ['People\u2019s United Bank', '#d22630'], ['Prosperity Bank', '#00528c'], ['Raymond James Bank', '#0b4f6c'], ['Simple', '#26c485'], ['Stifel Bank', '#006747'], ['TIAA Bank', '#0b3d91'], ['UMB Bank', '#a6192e'], ['Umpqua Bank', '#d2232a'], ['Valley National Bank', '#d50032'], ['Webster Bank', '#00875a'], ['Western Alliance Bank', '#0a3a6b'], ['Wintrust Bank', '#00a3ad'], ['Varo Bank', '#5b3ff2'], ['Current', '#111111'], ['Wise US', '#9fe870'], ['PenFed Credit Union', '#00539b'], ['Alliant Credit Union', '#0f6f5a'], ['Golden 1 Credit Union', '#f2a900'], ['BECU', '#0067a5'], ['SchoolsFirst FCU', '#00538a'], ['Suncoast Credit Union', '#00a79d'], ['Digital Federal Credit Union', '#1d4f91'], ['Space Coast Credit Union', '#0a68b0']];
  const rtn = name => { let h = 7; for (const c of name) h = (h * 131 + c.charCodeAt(0)) % 100000000; const d = String(h).padStart(8, '0').split('').map(Number); d[0] = h % 4; const w = [3, 7, 1, 3, 7, 1, 3, 7]; const sum = d.reduce((a, x, i) => a + x * w[i], 0); return d.join('') + ((10 - sum % 10) % 10); };
  window.MH_ROUTING = rtn('Mountain Hills County Credit Union');
  const bank = n => BANKS.find(b => b[0] === n);
  const bt = n => { const b = bank(n); const ini = n.split(/[\s&.]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); return `<span class="bt" style="background:${b ? b[1] : '#5c7772'}">${esc(ini)}</span>`; };
  const abaOk = r => /^\d{9}$/.test(r) && ([3, 7, 1, 3, 7, 1, 3, 7, 1].reduce((s, w, i) => s + w * Number(r[i]), 0) % 10 === 0);
  const parseAmt = v => Number(String(v).replace(/[^0-9.]/g, ''));
  const dayLabel = d => { const x = new Date(d), t = new Date(); const s = new Date(t.getFullYear(), t.getMonth(), t.getDate()); const y = new Date(s); y.setDate(y.getDate() - 1); const xd = new Date(x.getFullYear(), x.getMonth(), x.getDate()); if (+xd === +s) return 'Today'; if (+xd === +y) return 'Yesterday'; return x.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); };
  const time = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const COLORS = ['#1b5a52', '#cde8a4', '#e9c46a', '#7ee0d0', '#e76f51', '#8ab6f9'];
  const cat = t => { const s = `${t.recipient_name} ${t.description}`.toLowerCase(); if (/bill payment|verizon|comcast|edison|electric|water|insurance|state farm/.test(s)) return 'Bills & utilities'; if (/rent|mortgage|landlord/.test(s)) return 'Housing'; if (/uber|lyft|fuel|transit|airline/.test(s)) return 'Transport'; if (/netflix|spotify|subscription/.test(s)) return 'Subscriptions'; if (/grocer|food|restaurant|cafe|market|dinner/.test(s)) return 'Food & shopping'; return 'Transfers'; };
  const avail = a => Number(a.available_balance) - Number(a.held || 0);
  const MLAB = { instant: 'Instant', same: 'Same-day ACH', ach: 'Standard ACH', wire: 'Wire transfer' };
  const RL = { DEBIT_BLOCK: 'Outgoing payments restricted', FULL_FREEZE: 'Account frozen', UNDER_REVIEW: 'Account under review', DORMANT: 'Dormant account', COMPLIANCE_HOLD: 'Compliance hold', FRAUD_HOLD: 'Security hold', CLOSED_PENDING: 'Closure in progress' };
  window.RL = RL;
  const fit = el => { if (!el) return; el.style.whiteSpace = 'nowrap'; let fs = parseFloat(getComputedStyle(el).fontSize) || 40; while (el.scrollWidth > el.clientWidth + 1 && fs > 18) { fs -= 2; el.style.fontSize = fs + 'px'; } };
  const eta = m => { if (m === 'instant') return 'Within seconds'; if (m === 'same') return 'Today, by 11:59 PM ET'; if (m === 'wire') return 'Today, within a few hours'; const add = n => { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++; } return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }; return `${add(1)} \u2013 ${add(3)}`; };
  const svgi = k => `<svg viewBox="0 0 24 24">${ICON[k] || ICON.CURRENT}</svg>`;

  /* ================= DASHBOARD ================= */
  window.switchAccount = id => { state.account = state.data.accounts.find(a => a.id === id) || state.account; dashboard(); };
  dashboard = async () => {
    try {
      state.data = await api('/api/customer/dashboard');
      state.account = state.data.accounts.find(a => a.id === state.account?.id) || state.data.accounts[0];
      const a = state.account; if (!a) throw Error('No account is available.');
      const [goalsR, payeesR] = await Promise.all([api('/api/customer/goals').catch(() => ({ goals: [] })), api('/api/customer/payees').catch(() => ({ payees: [] }))]);
      const D = state.data, all = D.accounts, total = all.reduce((s, x) => s + avail(x), 0);
      const done = D.transactions.filter(t => t.status === 'COMPLETED');
      // balance-over-time (walk backwards from today)
      const days = 30, pts = []; let bal = total;
      for (let i = 0; i <= days; i++) { const d0 = new Date(); d0.setHours(23, 59, 59, 999); d0.setDate(d0.getDate() - i); pts.unshift(bal); const dayStart = new Date(d0); dayStart.setHours(0, 0, 0, 0); bal += done.filter(t => { const c = new Date(t.created_at); return c >= dayStart && c <= d0; }).reduce((s, t) => s + Number(t.amount), 0); }
      const mn = Math.min(...pts), mx = Math.max(...pts), rng = (mx - mn) || 1;
      const path = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / days) * 400} ${100 - ((v - mn) / rng) * 70 - 8}`).join(' ');
      // spending donut
      const m = {}; done.forEach(t => { const c = cat(t); m[c] = (m[c] || 0) + Number(t.amount); });
      const cats = Object.entries(m).sort((x, y) => y[1] - x[1]), out = cats.reduce((s, c) => s + c[1], 0) || 1, C = 2 * Math.PI * 52; let off = 0;
      const rings = cats.map((c, i) => { const l = c[1] / out * C, el = `<circle cx="70" cy="70" r="52" stroke="${COLORS[i % 6]}" stroke-width="15" fill="none" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += l; return el; }).join('');
      // activity grouped by day
      const acctTx = D.transactions.filter(t => t.account_id === a.id).slice(0, 8); let lastDay = ''; const act = acctTx.map(t => { const dl = dayLabel(t.created_at), head = dl !== lastDay ? `<div class="daylab">${dl}</div>` : ''; lastDay = dl; const st = String(t.status).toLowerCase(); return `${head}<div class="tx" role="button" tabindex="0" onclick="receipt(${t.id})" onkeydown="if(event.key==='Enter')receipt(${t.id})"><span class="av" style="background:${avColor(t.recipient_name)}">${esc(t.recipient_name[0])}</span><span class="m"><span class="tn">${esc(t.recipient_name)}</span><span class="ts">${esc(String(t.recipient_bank).split(' \u00b7 RTN ')[0])} \u00b7 ${esc(MLAB[t.delivery_method] || 'Transfer')} \u00b7 ${time(t.created_at)}</span></span><span class="r"><b>\u2212${money(t.amount)}</b><small class="${st}">${esc(t.status_label || (st === 'completed' ? cat(t) : t.status[0] + t.status.slice(1).toLowerCase()))}</small></span></div>`; }).join('') || '<p class="muted" style="padding:16px 0">No activity on this account yet. Send your first transfer to get started.</p>';
      const nowD = new Date(); const dueList = payeesR.payees.filter(p => !(p.last_paid_at && new Date(p.last_paid_at).getMonth() === nowD.getMonth())).slice(0, 3);
      const first = esc(state.user.name.split(' ')[0]);
      app.innerHTML = window.__shell('overview', `<div class="dv">
        <header class="dv-top"><div><small><span id="live-date"></span></small><h1><span id="live-greeting">${greet()}</span>, ${first}</h1></div><div class="dv-tools"><button class="bell" onclick="customerNotifications()" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0"/></svg>${D.unreadNotifications ? `<i>${D.unreadNotifications}</i>` : ''}</button><div class="avatar">${first[0]}</div></div></header>
        <section class="dv-hero"><div class="tot"><div style="position:relative;z-index:1"><small>Available balance \u00b7 ${all.length} account${all.length > 1 ? 's' : ''}</small><div class="amt" id="tot-amt">${money(total)}</div><div class="sub"><span class="tchip">Current ${money(all.reduce((s, x) => s + Number(x.balance), 0))}</span>${all.reduce((s, x) => s + Number(x.held || 0), 0) > 0 ? `<span class="tchip">${money(all.reduce((s, x) => s + Number(x.held || 0), 0))} on hold</span>` : ''}<span class="upd">Updated ${time(new Date())}</span></div></div>
          <svg class="spark" viewBox="0 0 400 100" preserveAspectRatio="none"><path class="a" d="${path} L400 100 L0 100Z"/><path class="l" d="${path}"/></svg>
          <div class="acts"><button class="p" onclick="openTransfer()">\u2191 Send money</button><button onclick="customerBills()">Pay bills</button><button onclick="customerCards()">Cards</button></div></div>
          <aside class="acctcard"><div><span class="k">${esc(a.account_type)}</span><h3>${esc(a.name)}</h3><div class="bal">${money(avail(a))}</div><small style="color:var(--soft)">Available${a.held > 0 ? ` \u00b7 ${money(a.held)} on hold` : ''}</small></div><dl><div><dt>Routing number</dt><dd>${window.MH_ROUTING}</dd></div><div><dt>Account number</dt><dd>${esc(mask(a.account_number))}</dd></div><div><dt>Status</dt><dd style="font-family:Manrope">${esc(a.status !== 'ACTIVE' ? 'Suspended' : (RL[a.restriction] || 'Active'))}</dd></div><div><dt>Interest</dt><dd style="font-family:Manrope">${(a.apy != null ? Number(a.apy).toFixed(2) : a.account_type === 'SAVINGS' ? '4.35' : '0.01')}% APY</dd></div></dl></aside></section>
        <section class="tiles">${all.map(x => `<button class="tile ${x.id === a.id ? 'on' : ''}" onclick="switchAccount(${x.id})"><span class="ti">${svgi(x.account_type)}</span><div><small>${esc(x.account_type)} \u00b7 ${esc(mask(x.account_number))}</small><b>${esc(x.name)}</b><strong>${money(avail(x))}</strong></div></button>`).join('')}</section>
        <section class="dv-cols"><div><article class="card2"><div class="hd"><h2>Recent activity</h2><button class="text-button" onclick="transactions()">See all</button></div>${act}</article>
          <div class="tip"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg><div><b>We will never ask for your password</b><span>Mountain Hills staff never request your code or PIN by phone, text or email.</span></div></div></div>
          <div><article class="card2"><div class="hd"><h2>Where it went</h2><button class="text-button" onclick="customerInsights()">Insights</button></div><div style="display:flex;justify-content:center;margin-top:8px"><svg viewBox="0 0 140 140" style="width:170px;height:170px"><circle cx="70" cy="70" r="52" stroke="#eef3f0" stroke-width="15" fill="none"/>${rings}<text x="70" y="67" text-anchor="middle" font-size="10" fill="#688087" font-family="Manrope">Total out</text><text x="70" y="86" text-anchor="middle" font-size="15" font-weight="700" fill="#102a32" font-family="Manrope">${money(out === 1 && !cats.length ? 0 : out).replace('.00', '')}</text></svg></div><div class="legend2">${cats.map((c, i) => `<div><b style="font-weight:500"><i style="background:${COLORS[i % 6]}"></i>${esc(c[0])}</b><span>${money(c[1])}</span></div>`).join('') || '<span class="muted">Nothing spent yet.</span>'}</div></article>
          <article class="card2"><div class="hd"><h2>Upcoming bills</h2><button class="text-button" onclick="customerBills()">Pay</button></div>${dueList.map(p => `<div class="upc"><span class="lg" style="background:${esc(p.color)}">${esc(p.name[0])}</span><div><b>${esc(p.name)}</b><small>${esc(p.category)}${p.due_day ? ' \u00b7 due on the ' + p.due_day + (p.due_day % 10 === 1 && p.due_day !== 11 ? 'st' : p.due_day % 10 === 2 && p.due_day !== 12 ? 'nd' : p.due_day % 10 === 3 && p.due_day !== 13 ? 'rd' : 'th') : ''}</small></div><button onclick="customerBills()">Pay</button></div>`).join('') || '<p class="muted" style="padding:10px 0">You\u2019re all caught up.</p>'}</article>
          <article class="card2"><div class="hd"><h2>Goals</h2><button class="text-button" onclick="customerGoals()">Manage</button></div>${goalsR.goals.slice(0, 3).map(g => { const p = Math.min(100, Math.round(g.saved / g.target * 100)); return `<div class="gmini"><div class="row"><b>${esc(g.name)}</b><span>${p}%</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join('') || '<p class="muted" style="padding:10px 0">Set a goal and watch it fill up.</p>'}</article></div></section></div>`);
      fit($('#tot-amt')); (() => { const el = $('#tot-amt'); if (!el) return; const to = total, t0 = performance.now(); const stepc = n => { const p = Math.min((n - t0) / 1100, 1), e = 1 - Math.pow(1 - p, 4); el.textContent = money(to * e); if (p < 1) requestAnimationFrame(stepc); else { el.textContent = money(to); fit(el); } }; requestAnimationFrame(stepc); })(); addEventListener('resize', () => { const e = $('#tot-amt'); if (e) { e.style.fontSize = ''; fit(e); } }, { once: true });
      clearTimeout(window.__dp); if (D.transactions.some(t => ['PENDING', 'PROCESSING'].includes(t.status))) window.__dp = setTimeout(() => { if (document.querySelector('.dv')) dashboard(); }, 15000);
    } catch (e) { toast(e.message); }
  };

  /* ================= TRANSFER ================= */
  let T = null;
  const METHODS = [['ach', 'Standard ACH', '1\u20133 business days'], ['same', 'Same-day ACH', 'By end of day'], ['instant', 'Instant', 'Within seconds'], ['wire', 'Wire transfer', 'Same business day']];
  const feeOf = m => Number((T.opts.fees || {})[m] || 0), feeTxt = m => feeOf(m) > 0 ? `${money(feeOf(m))} fee` : 'No fee';
  const shut = () => { document.querySelector('.tf')?.remove(); document.body.style.overflow = ''; T = null; };
  const acct = () => T.accounts.find(a => a.id === T.d.accountId) || T.accounts[0];
  const meth = () => METHODS.find(m => m[0] === T.d.method);

  window.openTransfer = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      const accounts = state.data.accounts.filter(a => !a.status || a.status === 'ACTIVE').map(a => ({ ...a, available_balance: avail(a) })); if (!accounts.length) return toast('No account is available for transfers.');
      const opts = await api('/api/customer/transfer-options').catch(() => ({ methods: { instant: true, same: true, ach: true }, blocked: {}, max: 0 }));
      T = { opts, accounts, step: 1, d: { accountId: accounts.find(a => a.id === state.account?.id)?.id || accounts[0].id, amount: '', name: '', acct: '', routing: '', bank: '', method: 'instant', note: '' } };
      document.querySelector('.tf')?.remove(); document.body.style.overflow = 'hidden';
      document.body.insertAdjacentHTML('beforeend', `<div class="tf" role="dialog" aria-modal="true"><section class="tf-stage"><div class="wm">Mountain Hills</div><div><h2 id="tf-h">Send money, <em>simply.</em></h2><p id="tf-p">Move money to any U.S. bank account. You\u2019ll review every detail before anything leaves your account.</p><div class="tf-route"><div class="node" id="n-from"><small>From</small><div><b id="pv-from"></b><span class="bl" id="pv-bal"></span></div></div><div class="line"></div><div class="node" id="n-to"><span class="rav" id="pv-av">?</span><div><small>To</small><b id="pv-to">Recipient</b></div></div></div><div class="tf-amount" id="pv-amt"><span>$</span>0.00</div></div><div></div></section><section class="tf-sheet"><div class="tf-head"><h3 id="tf-t">Send money</h3><button class="tf-x" id="tf-x" aria-label="Close">\u2715</button></div><div class="tf-prog"><i></i><i></i><i></i><i></i></div><div class="tf-body" id="tf-b"></div></section></div>`);
      $('#tf-x').onclick = shut; addEventListener('keydown', esc1); preview(); stepDetails();
    } catch (e) { toast(e.message); }
  };
  const esc1 = e => { if (e.key === 'Escape' && T && T.step < 4) { shut(); removeEventListener('keydown', esc1); } };
  const preview = () => { if (!T) return; const d = T.d, a = acct(); $('#pv-from').textContent = a.name; $('#pv-bal').textContent = `${mask(a.account_number)} \u00b7 ${money(a.available_balance)}`; $('#pv-to').textContent = d.name || 'Recipient'; const av = $('#pv-av'); av.textContent = (d.name || '?')[0].toUpperCase(); av.style.background = d.name ? avColor(d.name) : '#ffffff1a'; $('#n-to').classList.toggle('lit', !!d.name); const v = parseAmt(d.amount); $('#pv-amt').innerHTML = `<span>$</span>${v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`; };
  const setStep = (n, title) => { T.step = n; $('#tf-t').textContent = title; $$('.tf-prog i').forEach((i, k) => i.classList.toggle('on', k < Math.min(n, 4))); const b = $('#tf-b'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; };

  function stepDetails() {
    const d = T.d; setStep(1, 'Send money');
    $('#tf-b').innerHTML = `<form id="tf-f" novalidate>
      <span class="tf-lab">From</span><div class="tf-from">${T.accounts.map(a => `<button type="button" data-id="${a.id}" class="${a.id === d.accountId ? 'on' : ''}"><span class="rd"></span><div><b>${esc(a.name)}</b><small>${esc(mask(a.account_number))} \u00b7 ${esc(a.account_type)}</small></div><strong>${money(a.available_balance)}</strong></button>`).join('')}</div>
      <span class="tf-lab">Amount</span><div class="amt-in"><span>$</span><input id="tf-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(d.amount)}"></div><div class="chips">${[100, 500, 1000, 5000].map(v => `<button type="button" data-q="${v}">$${v.toLocaleString()}</button>`).join('')}<button type="button" data-q="max">Max</button></div><div class="tf-err" id="tf-err"></div>
      ${(() => { const seen = new Set(), rr = []; (state.data.transactions || []).forEach(t => { const k = t.recipient_account; if (!seen.has(k) && rr.length < 6 && !/^bill payment/i.test(t.description || '')) { seen.add(k); rr.push(t); } }); T.rr = rr; return rr.length ? `<span class="tf-lab">Recent recipients</span><div class="chips" id="rr" style="margin:0 0 4px">${rr.map((t, i) => `<button type="button" data-r="${i}">${esc(t.recipient_name)}</button>`).join('')}</div>` : ''; })()}
      <span class="tf-lab">Recipient</span>
      <div class="f" style="margin-top:0"><label>Full name on account</label><input name="rname" autocomplete="off" maxlength="80" value="${esc(d.name)}" placeholder="e.g. Jordan Ellis"></div>
      <div class="f"><label>Bank</label><div class="combo" id="cb"><input name="bank" autocomplete="off" maxlength="60" value="${esc(d.bank)}" placeholder="Search U.S. banks"><div class="list"></div></div></div>
      <div class="f"><label>Routing number (ABA)</label><input name="routing" inputmode="numeric" maxlength="9" autocomplete="off" value="${esc(d.routing)}" placeholder="9 digits"><small style="display:block;margin-top:6px;color:var(--soft)">Filled in automatically when you pick a bank. These are sample numbers for this fictional network.</small><div class="rv" id="rv"></div></div>
      <div class="f"><label>Account number</label><input name="acct" inputmode="numeric" maxlength="17" autocomplete="off" value="${esc(d.acct)}"></div>
      <div class="f"><label>Confirm account number</label><input name="acct2" inputmode="numeric" maxlength="17" autocomplete="off" value="${esc(d.acct2 || '')}" placeholder="Re-enter the account number"></div>
      <div class="f"><label>Purpose</label><select name="purpose">${['Family & friends', 'Rent or mortgage', 'Bills & services', 'Goods or services', 'Savings & investing', 'Gift', 'Other'].map(p => `<option ${d.purpose === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <span class="tf-lab">Delivery</span><div class="meth">${METHODS.map(m => `<button type="button" data-m="${m[0]}"><b>${m[1]}</b><small>${m[2]}</small></button>`).join('')}</div><div class="xhint" id="mh"></div>
      <div class="f"><label>Memo <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="note" maxlength="100" value="${esc(d.note)}" placeholder="What\u2019s it for?"></div>
      <div class="tf-ferr" id="tf-ferr" role="alert"></div><button class="tf-cta" type="submit">Review transfer</button></form>`;
    const f = $('#tf-f'), amt = $('#tf-amt'), err = $('#tf-err');
    if (T.flash) { $('#tf-ferr').textContent = T.flash; T.flash = ''; }
    $$('.tf-from button').forEach(b => b.onclick = () => { d.accountId = Number(b.dataset.id); $$('.tf-from button').forEach(x => x.classList.toggle('on', x === b)); preview(); refreshMeth(); });
    const off = m => !T.opts.methods[m] || (T.opts.blocked[d.accountId] || []).includes(m);
    const refreshMeth = () => { if (off(d.method)) d.method = METHODS.find(m => !off(m[0]))?.[0] || d.method; $$('.meth button').forEach(b => { const o = off(b.dataset.m); b.disabled = o; b.classList.toggle('off', o); b.classList.toggle('on', b.dataset.m === d.method && !o); $('small', b).textContent = o ? 'Unavailable right now' : `${METHODS.find(m => m[0] === b.dataset.m)[2]} \u00b7 ${feeTxt(b.dataset.m)}`; }); $('#mh').textContent = METHODS.every(m => off(m[0])) ? 'No delivery speeds are available on this account right now. Please contact support.' : `Expected arrival: ${eta(d.method)}${feeOf(d.method) > 0 ? ' \u00b7 ' + feeTxt(d.method) : ''}`; };
    $$('.meth button').forEach(b => b.onclick = () => { if (b.disabled) return; d.method = b.dataset.m; refreshMeth(); });
    $$('.chips button').forEach(b => b.onclick = () => { const v = b.dataset.q === 'max' ? Math.max(0, Number(acct().available_balance) - feeOf(d.method)) : Number(b.dataset.q); amt.value = v.toLocaleString('en-US', { maximumFractionDigits: 2 }); d.amount = amt.value; err.textContent = ''; preview(); });
    refreshMeth();
    amt.oninput = () => { let v = amt.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); if (p.length > 2) v = p[0] + '.' + p.slice(1).join(''); const [i, fr] = v.split('.'); amt.value = (i ? Number(i).toLocaleString('en-US') : '') + (fr !== undefined ? '.' + fr.slice(0, 2) : ''); d.amount = amt.value; err.textContent = ''; preview(); };
    f.elements.rname.oninput = () => { d.name = f.elements.rname.value; preview(); };
    $$('#rr button').forEach(b => b.onclick = () => { const t = T.rr[Number(b.dataset.r)], el = f.elements; el.rname.value = d.name = t.recipient_name; el.acct.value = t.recipient_account; const bk = String(t.recipient_bank).split(' \u00b7 RTN ')[0]; el.bank.value = d.bank = bk; el.routing.value = d.routing = (String(t.recipient_bank).split(' \u00b7 RTN ')[1]) || rtn(bk); preview(); });
    const rv = $('#rv'), checkRtn = () => { const val = f.elements.routing.value.trim(); d.routing = val; if (val.length < 9) { rv.textContent = ''; rv.className = 'rv'; return; } if (!abaOk(val)) { rv.textContent = '\u2715 This routing number isn\u2019t valid'; rv.className = 'rv bad'; return; } const hit = BANKS.find(b => rtn(b[0]) === val); rv.textContent = hit ? `\u2713 Valid routing number \u00b7 ${hit[0]}` : '\u2713 Valid routing number'; rv.className = 'rv ok'; if (hit && !f.elements.bank.value.trim()) { f.elements.bank.value = d.bank = hit[0]; } };
    f.elements.routing.addEventListener('input', checkRtn); checkRtn();
    f.elements.acct.oninput = () => f.elements.acct.value = f.elements.acct.value.replace(/\D/g, ''); f.elements.routing.oninput = () => f.elements.routing.value = f.elements.routing.value.replace(/\D/g, '');
    const cb = $('#cb'), list = $('.list', cb), bi = f.elements.bank;
    const draw = () => { const q = bi.value.trim().toLowerCase(); const m = BANKS.filter(b => b[0].toLowerCase().includes(q)).slice(0, 12); list.innerHTML = m.map(b => `<div class="opt" data-b="${esc(b[0])}">${bt(b[0])}<span>${esc(b[0])}</span></div>`).join(''); cb.classList.toggle('open', !!m.length && document.activeElement === bi); $$('.opt', list).forEach(o => o.onmousedown = e => { e.preventDefault(); bi.value = o.dataset.b; d.bank = bi.value; f.elements.routing.value = d.routing = rtn(bi.value); cb.classList.remove('open'); }); };
    bi.onfocus = bi.oninput = () => { d.bank = bi.value; draw(); }; bi.onblur = () => cb.classList.remove('open');
    f.onsubmit = e => {
      e.preventDefault(); Object.assign(d, { name: f.elements.rname.value.trim(), bank: bi.value.trim(), routing: f.elements.routing.value.trim(), acct: f.elements.acct.value.trim(), note: f.elements.note.value.trim(), amount: amt.value });
      const v = parseAmt(amt.value); if (!(v > 0)) { err.textContent = 'Enter an amount to send.'; return amt.focus(); }
      if (T.opts.max > 0 && v > T.opts.max) { err.textContent = `Transfers are limited to $${T.opts.max.toLocaleString('en-US')} each.`; return amt.focus(); }
      if (v + feeOf(d.method) > Number(acct().available_balance)) { err.textContent = 'That is more than the available balance in this account.'; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); return amt.focus(); }
      const fe = m => { const x = $('#tf-ferr'); x.textContent = m; x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); x.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (d.name.length < 2) return fe('Enter the recipient\u2019s full name.'); if (!d.bank) return fe('Choose the recipient\u2019s bank.');
      if (!abaOk(d.routing)) return fe('Enter a valid 9-digit routing number, or pick the bank from the list to fill it in.');
      if (!/^\d{6,17}$/.test(d.acct)) return fe('Account numbers are 6 to 17 digits.');
      d.acct2 = f.elements.acct2.value.trim(); d.purpose = f.elements.purpose.value;
      if (d.acct2 !== d.acct) return fe('The account numbers don\u2019t match. Please re-enter them.');
      d.value = Math.round(v * 100) / 100; d.fee = feeOf(d.method); stepReview();
    };
  }

  function stepReview() {
    T.d.isNew = !(state.data.transactions || []).some(t => t.recipient_account === T.d.acct);
    const d = T.d, a = acct(), r = (k, v, c = '') => `<div class="r ${c}"><span>${k}</span><b>${v}</b></div>`;
    setStep(2, 'Review');
    $('#tf-b').innerHTML = `<div class="center" style="margin-bottom:20px"><small class="tf-lab" style="margin:0 0 8px">You are sending</small><div class="res-amt">${money(d.value)}</div><span class="muted">to ${esc(d.name)}</span></div>
      <div class="tk">${r('Recipient', esc(d.name))}${r('Bank', esc(d.bank))}${d.routing ? r('Routing no.', esc(d.routing)) : ''}${r('Account no.', esc(mask(d.acct)))}${r('From', `${esc(a.name)} ${esc(mask(a.account_number))}`)}${r('Delivery', `${esc(meth()[1])}`)}${r('Expected arrival', esc(eta(d.method)))}${d.purpose ? r('Purpose', esc(d.purpose)) : ''}${d.note ? r('Memo', esc(d.note)) : ''}${r('Transfer fee', d.fee > 0 ? money(d.fee) : 'No fee')}${r('Total debited', money(d.value + d.fee), 't')}</div>
      ${d.isNew ? `<label class="newr"><input type="checkbox" id="new-ok"><span><b>New recipient.</b> You haven\u2019t sent money to ${esc(d.name)} before. Only send money to people you know and trust. Banks never ask you to move money to \u201csafe\u201d accounts.</span></label>` : ''}${d.value >= 10000 ? '<div class="review-note" style="margin-top:12px">Transfers of $10,000 or more may be reviewed before they are released.</div>' : ''}<p class="muted" style="font-size:13px;line-height:1.55;margin:16px 2px 0">Check the details carefully. Transfers sent to the wrong account may not be recoverable.</p><div class="tf-err" id="rv-err"></div>
      <div class="slide" id="sl"><div class="fill"></div><span>Slide to continue</span><div class="knob">\u203a</div></div><button class="tf-ghost" id="tf-edit">Edit details</button>`;
    $('#tf-edit').onclick = stepDetails;
    const sl = $('#sl'), knob = $('.knob', sl), fill = $('.fill', sl); let drag = false, sx = 0, max = 0;
    const move = x => { const p = Math.max(0, Math.min(max, x - sx)); knob.style.transform = `translateX(${p}px)`; fill.style.width = (p + 60) + 'px'; if (p >= max - 2) { drag = false; up(true); } };
    const up = ok => { if (!drag && !ok) return; drag = false; if (ok) { knob.style.transform = `translateX(${max}px)`; setTimeout(stepAuth, 200); } else { knob.style.transition = fill.style.transition = '.3s'; knob.style.transform = ''; fill.style.width = '60px'; setTimeout(() => knob.style.transition = fill.style.transition = '', 320); } };
    knob.addEventListener('pointerdown', e => { if (d.isNew && !$('#new-ok').checked) { $('#rv-err').textContent = 'Please confirm you know and trust this recipient first.'; return; } $('#rv-err').textContent = ''; drag = true; max = sl.clientWidth - 60; sx = e.clientX; knob.setPointerCapture(e.pointerId); });
    knob.addEventListener('pointermove', e => { if (drag) move(e.clientX); }); knob.addEventListener('pointerup', () => up(false)); knob.addEventListener('pointercancel', () => up(false));
    knob.setAttribute('tabindex', '0'); knob.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (d.isNew && !$('#new-ok').checked) { $('#rv-err').textContent = 'Please confirm you know and trust this recipient first.'; return; } stepAuth(); } });
  }

  function stepAuth(errMsg) {
    setStep(3, 'Enter your transfer PIN');
    $('#tf-b').innerHTML = `<div class="center"><div class="lockb"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div><h3 style="margin:0 0 8px;font-size:22px;letter-spacing:-.03em">Enter your transfer PIN</h3><p class="muted" style="line-height:1.55;margin:0">Enter your 6-digit transfer PIN to approve this ${money(T.d.value)} transfer. Don\u2019t know it? Contact support.</p></div>
      <div class="otp2" id="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1}">`).join('')}</div><div class="tf-ferr center" id="tf-perr" role="alert">${esc(errMsg || '')}</div><button class="tf-cta" id="tf-go" disabled>Confirm and send</button><button class="tf-ghost" id="tf-back">Back to review</button>`;
    const bx = $$('#otp input'), go = $('#tf-go'), sync = () => go.disabled = bx.some(b => !b.value);
    bx.forEach((b, i) => { b.oninput = () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && bx[i + 1]) bx[i + 1].focus(); sync(); }; b.onkeydown = e => { if (e.key === 'Backspace' && !b.value && bx[i - 1]) bx[i - 1].focus(); if (e.key === 'Enter' && !go.disabled) go.click(); }; b.onpaste = e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); [...t].forEach((c, k) => bx[k].value = c); bx[Math.min(t.length, 5)].focus(); sync(); }; });
    bx[0].focus(); $('#tf-back').onclick = stepReview; go.onclick = () => { T.pin = bx.map(b => b.value).join(''); send(); };
  }

  async function send() {
    const d = T.d, steps = ['Verifying your PIN', 'Checking available funds', `Routing to ${d.bank}`, 'Confirming with the receiving bank'];
    setStep(4, 'Sending'); $('.tf').classList.add('sending'); $('#n-from').classList.add('lit');
    $('#tf-h').innerHTML = 'Sending <em>securely.</em>'; $('#tf-p').textContent = 'Your transfer is being processed. This only takes a moment.';
    $('#tf-b').innerHTML = `<div class="center"><div class="ring"><svg viewBox="0 0 110 110"><circle class="bg" cx="55" cy="55" r="50"/><circle class="fg" id="rg" cx="55" cy="55" r="50"/></svg><b id="pc">0%</b></div><div class="rail4" id="r4"><span><i></i>You</span><span><i></i>Mountain Hills</span><span><i></i>${d.method === 'wire' ? 'Fedwire' : d.method === 'instant' ? 'RTP network' : 'ACH network'}</span><span><i></i>${esc(d.bank.split(' ').slice(0, 2).join(' '))}</span></div><h3 style="margin:0;font-size:22px">Processing your transfer</h3><p class="muted" style="margin:6px 0 0">Please keep this window open.</p><ul class="pl" id="pl">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    const li = $$('#pl li'); let k = 0; const paint = () => { li.forEach((x, i) => { x.classList.toggle('done', i < k); x.classList.toggle('on', i === k); }); const p = Math.min(100, Math.round(k / li.length * 100)); $('#rg').style.strokeDashoffset = 314 - 314 * p / 100; $('#pc').textContent = p + '%'; $$('#r4 span').forEach((x, i) => x.classList.toggle('on', i <= k)); const r4 = $('#r4'); if (r4) r4.style.setProperty('--p', Math.min(100, k / li.length * 100) + '%'); };
    paint(); const iv = setInterval(() => { if (k < li.length) { k++; paint(); } }, 800);
    const body = { pin: T.pin, method: d.method, accountId: d.accountId, recipientName: d.name, recipientAccount: d.acct, recipientBank: d.routing ? `${d.bank} \u00b7 RTN ${d.routing}` : d.bank, amount: d.value, description: [d.purpose && d.purpose !== 'Other' ? d.purpose : '', d.note].filter(Boolean).join(' \u00b7 ') };
    const call = api('/api/customer/transfers', { method: 'POST', body: JSON.stringify(body) }).then(r => ({ r }), e => ({ e }));
    const [o] = await Promise.all([call, new Promise(r => setTimeout(r, 3400))]); clearInterval(iv); k = li.length; paint(); await new Promise(r => setTimeout(r, 350));
    $('.tf')?.classList.remove('sending'); if (!T) return; if (o.e) { $('#n-from')?.classList.remove('lit'); /PIN|attempt/i.test(o.e.message) ? stepAuth(o.e.message) : /choose another|limited to/i.test(o.e.message) ? (T.flash = o.e.message, stepDetails()) : fail(o.e.message); } else result(o.r);
  }

  function fail(msg) {
    setStep(5, 'Not sent'); $('#tf-h').innerHTML = 'Something <em>went wrong.</em>'; $('#tf-p').textContent = 'No money left your account.';
    $('#tf-b').innerHTML = `<div class="center"><svg class="big-tick bad" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46"/><path d="M34 34l28 28M62 34L34 62"/></svg><h3 style="font-size:24px;margin:8px 0">Transfer not sent</h3><p class="muted" style="line-height:1.55">${esc(msg)}</p></div><button class="tf-cta" id="rt">Try again</button>${/suspend|support|declin/i.test(msg) ? '<button class="tf-ghost" id="sp" style="color:var(--g600);font-weight:700">Contact support</button>' : ''}<button class="tf-ghost" id="cl">Close</button>`;
    $('#rt').onclick = stepDetails; $('#cl').onclick = shut; $('#sp') && ($('#sp').onclick = () => { shut(); customerSupport(); });
  }

  function result(r) {
    const d = T.d, a = acct(), ok = r.status === 'COMPLETED', bad = r.status === 'FAILED', pend = !ok && !bad;
    setStep(5, ok ? 'Sent' : bad ? 'Not sent' : 'Received');
    $('#tf-h').innerHTML = ok ? 'It\u2019s <em>on its way.</em>' : bad ? 'It didn\u2019t <em>go through.</em>' : 'We\u2019ve <em>got it.</em>'; $('#tf-p').textContent = ok ? `${d.name} will receive this ${meth()[2].toLowerCase()}.` : bad ? (r.reason || 'Your balance is unchanged.') : `${meth()[1]}: ${meth()[2].toLowerCase()}. We\u2019ll notify you when it completes.`;
    const tick = ok ? '<path d="M28 50l14 14 27-30"/>' : bad ? '<path d="M34 34l28 28M62 34L34 62"/>' : '<path d="M48 26v24l15 9"/>';
    const cf = ok ? `<div class="confetti">${Array.from({ length: 34 }, () => `<i style="--x:${Math.round(Math.random() * 420 - 210)}px;--y:${Math.round(Math.random() * 260 - 60)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--dl:${(Math.random() * .3).toFixed(2)}s;background:${COLORS[Math.floor(Math.random() * 6)]}"></i>`).join('')}</div>` : '';
    const row = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;
    $('#tf-b').innerHTML = `${cf}<div class="center"><svg class="big-tick ${bad ? 'bad' : pend ? 'wait' : ''}" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46"/>${tick}</svg><h3 style="font-size:24px;margin:10px 0 0;letter-spacing:-.03em">${ok ? 'Transfer sent' : bad ? 'Transfer failed' : r.status === 'PENDING' ? 'Transfer pending' : 'Transfer processing'}</h3><div class="res-amt">${money(d.value)}</div><span class="muted">to ${esc(d.name)}</span></div>
      <div class="tk" style="margin-top:22px">${row('Bank', esc(d.bank))}${row('From', esc(a.name))}${row('Delivery', esc(meth()[1]))}${row('Fee', d.fee > 0 ? money(d.fee) : 'No fee')}${row('Total debited', money(d.value + d.fee))}${row('Expected arrival', esc(eta(d.method)))}${row('Reference', esc(r.reference))}${row('Status', esc(r.status[0] + r.status.slice(1).toLowerCase()))}</div>
      <button class="tf-cta" id="vr">View receipt</button>${bad ? '<button class="tf-ghost" id="sp" style="color:var(--g600);font-weight:700">Contact support</button>' : ''}<button class="tf-ghost" id="dn">Done</button><button class="tf-ghost" id="an" style="margin-top:0">Send another</button>`;
    api('/api/customer/dashboard').then(x => state.data = x).catch(() => { });
    $('#vr').onclick = () => { shut(); receipt(r.id); }; $('#sp') && ($('#sp').onclick = () => { shut(); customerSupport(); }); $('#dn').onclick = () => { shut(); dashboard(); }; $('#an').onclick = async () => { shut(); await dashboard(); openTransfer(); };
  }
  if (!document.querySelector('.fict')) document.body.insertAdjacentHTML('beforeend', '<div class="fict" role="note"><span>Mountain Hill County Credit Union \u00b7 Mountain Hills County Credit Union \u00b7 Move forward with more control. </span></div>');
}, 0);
