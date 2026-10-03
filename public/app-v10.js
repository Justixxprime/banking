// v10: bank-grade receipt, live crypto + stock markets and rates on the homepage.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ======================= RECEIPT ======================= */
  const ML = { instant: ['Instant', 'Within seconds'], same: ['Same-day ACH', 'By 11:59 PM ET'], ach: ['Standard ACH', '1\u20133 business days'], wire: ['Wire transfer', 'Same business day'], intl: ['International wire (SWIFT)', '1\u20133 business days'] };
  const fc = (v, c) => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(Number(v)); } catch { return `${Number(v).toFixed(2)} ${c}`; } };
  const hash = (text, len = 8) => { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).toUpperCase().padStart(8, '0').slice(0, len); };
  const digits = (text, n) => { let h = 7; for (const c of String(text)) h = (h * 131 + c.charCodeAt(0)) % 9999999967; return String(h).padStart(n, '0').slice(-n); };
  const longDate = d => new Date(d).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).replace(' at ', ' \u00b7 ');
  const shortDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const mk = n => `\u2022\u2022\u2022\u2022${String(n || '').slice(-4)}`;
  const eta = (m, from) => { const d = new Date(from); if (m === 'instant') return 'Within seconds'; if (m === 'same') return `${shortDate(d)}, by 11:59 PM ET`; if (m === 'wire') return `${shortDate(d)}, within a few hours`; const add = n => { const x = new Date(d); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++; } return shortDate(x); }; return `${add(1)} \u2013 ${add(3)}`; };
  const qr = seed => { let s = parseInt(hash(seed), 16) || 1; const N = 25, cells = []; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; const finder = (x, y) => (x < 7 && y < 7) || (x > N - 8 && y < 7) || (x < 7 && y > N - 8); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (finder(x, y)) { const fx = x < 7 ? x : x - (N - 7), fy = y < 7 ? y : y - (N - 7); const on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); } else if (rnd() > .52) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); } return `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" aria-hidden="true">${cells.join('')}</svg>`; };
  const bars = ref => { let seed = parseInt(hash(ref), 16) || 1, x = 0, out = ''; for (let i = 0; i < 64; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const w = 1 + ((seed >>> 28) % 3), g = 1 + ((seed >>> 26) % 2); out += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w + g; } return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`; };

  const receiptDoc = (t, holder) => {
    const st = String(t.status), cls = st.toLowerCase();
    const sl = t.status_label || ({ COMPLETED: 'Completed', PENDING: 'Pending', PROCESSING: 'Processing', FAILED: 'Failed' }[st] || st);
    const icon = { COMPLETED: '\u2713', PENDING: '\u25cf', PROCESSING: '\u25cf', FAILED: '\u2715' }[st] || '';
    const [bank0, rtnRaw] = String(t.recipient_bank || '').split(' \u00b7 RTN '); const intl = !!t.intl_country; const bank = intl ? bank0.split(' \u00b7 SWIFT ')[0] : bank0; const W = window.MH_WORLD, ctry = intl && W ? W.byCode(t.intl_country) : null;
    const m = ML[t.delivery_method] || ['Online transfer', ''];
    const rt = window.MH_ROUTING || '071000128', trace = rt.slice(0, 8) + String(t.id).padStart(7, '0');
    const conf = `${hash(t.reference + t.id, 4)}-${digits(t.reference + t.id, 6)}`;
    const fee = Number(t.fee || 0), total = st === 'FAILED' ? 0 : Number(t.amount) + fee;
    const done = st === 'COMPLETED', proc = st === 'PROCESSING' || done, bad = st === 'FAILED';
    const row = (k, v, c = '') => `<div class="rc-row ${c}"><span>${k}</span><b>${v}</b></div>`;
    return `<article class="rc" id="receipt-print">
      <header class="rc-head"><div class="rc-brand"><img class="rc-logo" src="/logo.svg" alt=""><div><b>Mountain Hills</b><small>County Credit Union</small></div></div><div class="rc-doc"><span>Transfer receipt</span><small>${esc(shortDate(t.created_at))}</small></div></header>
      <section class="rc-hero">${done ? '<svg class="rc-tick" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M19 33l9 9 17-19"/></svg>' : bad ? '<svg class="rc-tick bad" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M22 22l20 20M42 22L22 42"/></svg>' : '<svg class="rc-tick wait" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M32 18v15l10 6"/></svg>'}<span class="rc-stamp ${cls}">${esc(sl)}</span><div class="rc-amt">${money(t.amount)}</div><p>${bad ? 'This transfer was not completed. No money was sent.' : `Sent to <b>${esc(t.recipient_name)}</b>`}</p>${intl && !bad ? `<div class="rc-fx"><small>Beneficiary receives</small><b>${fc(t.dest_amount, t.intl_currency)}</b></div>` : ''}${t.status_message ? `<div class="rcpt-note" style="margin:14px 0 0">${esc(t.status_message)}</div>` : ''}</section>
      <div class="rc-route"><div><small>From</small><b>${esc(holder || 'Account holder')}</b><span>${esc(t.sender_account || 'Account')} ${mk(t.account_number)}</span></div><i>→</i><div><small>To</small><b>${esc(t.recipient_name)}</b><span>${esc(bank)} ${mk(t.recipient_account)}</span></div></div><div class="rc-tear"></div><section class="rc-ref"><div><small>Reference number</small><b id="rc-ref">${esc(t.reference)}</b></div><button class="rc-copy" type="button" data-copy="${esc(t.reference)}">Copy</button></section>
      <section class="rc-sec"><h4>Transfer details</h4>
        ${row('Date &amp; time', esc(longDate(t.created_at)))}${row('Confirmation number', esc(conf), 'mono')}${row('Transaction ID', 'TXN' + String(t.id).padStart(9, '0'), 'mono')}${row(intl ? 'SWIFT UETR' : 'ACH trace number', intl ? (hash(t.reference + 'u', 8) + '-' + hash(t.reference + 'v', 4) + '-4' + hash(t.reference + 'w', 3) + '-' + hash(t.reference + 'x', 4) + '-' + hash(t.reference + 'y', 12)).toLowerCase() : trace, 'mono')}${row('Transfer type', intl ? 'International wire transfer' : 'Outgoing transfer')}${row('Delivery speed', esc(m[0]))}${st !== 'FAILED' ? row('Expected arrival', esc(eta(t.delivery_method, t.created_at))) : ''}${t.description ? row('Memo', esc(t.description)) : ''}</section>
      <section class="rc-sec"><h4>From</h4>${row('Account holder', esc(holder || ''))}${row('Account', esc(t.sender_account || 'Mountain Hills account'))}${row('Account number', mk(t.account_number), 'mono')}${row('Routing number', esc(rt), 'mono')}</section>
      <section class="rc-sec"><h4>To</h4>${row('Beneficiary', esc(t.recipient_name))}${row('Bank', esc(bank))}${rtnRaw ? row('Routing number', esc(rtnRaw), 'mono') : ''}${intl ? row('SWIFT / BIC', esc(t.swift_bic || ''), 'mono') + (t.bank_type ? row('Bank type', esc(t.bank_type)) : '') + row('Country', esc((ctry ? W.flag(ctry.code) + ' ' + ctry.name : t.intl_country))) + (t.beneficiary_address ? row('Beneficiary address', esc(t.beneficiary_address)) : '') + row(/^[A-Z]{2}\d{2}/.test(t.recipient_account) ? 'IBAN' : 'Account number', esc(t.recipient_account), 'mono') : row('Account number', mk(t.recipient_account), 'mono')}</section>
      <section class="rc-sec"><h4>Summary</h4>${row('Transfer amount', money(t.amount))}${intl ? row('Exchange rate', `1 USD = ${Number(t.fx_rate).toLocaleString('en-US', { maximumSignificantDigits: 6 })} ${esc(t.intl_currency)}`) + row('Recipient gets', fc(t.dest_amount, t.intl_currency)) + row('Charges', t.charges === 'OUR' ? 'OUR \u2013 sender pays all fees' : 'SHA \u2013 shared fees') : ''}${row('Transfer fee', fee > 0 ? money(fee) : 'No fee')}${row('Total debited', money(total), 'total')}</section>
      <section class="rc-sec"><h4>Status</h4><ol class="tl"><li class="on"><b>Submitted</b><small>${esc(longDate(t.created_at))}</small></li><li class="${proc ? 'on' : ''}"><b>Processing</b><small>${proc ? 'Sent to the receiving bank' : 'Waiting to be processed'}</small></li><li class="${done ? 'on' : bad ? 'bad' : ''}"><b>${bad ? esc(t.status_label || 'Failed') : 'Completed'}</b><small>${done ? 'Funds delivered' : bad ? esc(t.failure_reason || 'Not completed. No money was sent.') : 'Not yet completed'}</small></li></ol></section>
      <section class="rc-verify"><div class="rc-qr">${qr(t.reference)}</div><div><small>Receipt verification code</small><b>MH-${hash(t.reference, 8)}</b><span>Quote this code and your reference number when you contact support.</span></div></section>
      <div class="rc-bars">${bars(t.reference)}<small>${esc(t.reference)}</small></div>
      <footer class="rc-foot"><p>This is an electronically generated receipt and does not require a signature. Keep it for your records.</p><p><b>Questions?</b> Call 1-202-202-4033 (Mon\u2013Fri 8am\u20138pm ET) or message us from Support in your dashboard.</p><p class="rc-fict">Mountain Hills County Credit Union. By using this site, you accept DCU's Terms of Use and Privacy Practices. Digital Federal Credit Union and Mountain Hills County Credit Union have merged to form a single credit union named Mountain Hills County Credit Union. As we work to combine operations, we are operating as two divisions named: Digital Federal Credit Union (DCU) and Mountain Hills County Credit Union</p></footer>
    </article><div class="rc-zig"></div>`;
  };
  const wire = () => $$('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1400); });
  window.receipt = async id => {
    try {
      const { transaction: t, customer } = await api(`/api/customer/transactions/${id}/receipt`);
      app.innerHTML = `<main class="site rcpt-page page-enter"><div class="topline"><div class="wordmark">Mountain Hills</div><button class="ghost" onclick="dashboard()">\u2190 Back</button></div><div class="rc-wrap">${receiptDoc(t, customer?.name)}<div class="rc-actions"><button class="cta" onclick="window.print()">Download / Print PDF</button><button class="secondary-button" id="rc-share">Share</button>${t.status === 'FAILED' || t.status_message ? '<button class="secondary-button" onclick="customerSupport()">Contact support</button>' : ''}<button class="secondary-button" onclick="transactions()">All activity</button></div></div></main>`;
      wire(); window.scrollTo(0, 0);
      $('#rc-share').onclick = async () => { const text = `Mountain Hills transfer ${t.reference} \u2013 ${money(t.amount)} to ${t.recipient_name}`; try { if (navigator.share) await navigator.share({ title: 'Transfer receipt', text }); else { await navigator.clipboard.writeText(text); toast('Receipt details copied.'); } } catch (e) { /* cancelled */ } };
    } catch (e) { toast(e.message); }
  };
  window.viewAdminReceipt = async id => {
    try {
      const { transaction: t, customer } = await api(`/api/admin/transactions/${id}/receipt`);
      closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2 rcpt-modal"><div style="max-width:560px"><div class="topline"><h2>Receipt</h2><button class="close" type="button" onclick="closeModal()">Close</button></div><div class="rc-wrap">${receiptDoc(t, customer?.name)}<div class="rc-actions"><button class="cta" onclick="window.print()">Print</button><button class="secondary-button" onclick="adminSetStatus(${t.id})">Status</button><button class="secondary-button" onclick="editTransaction(${t.id})">Edit</button><button class="danger-btn" onclick="deleteTransactionPrompt(${t.id})">Delete</button></div></div></div></div>`); wire();
    } catch (e) { toast(e.message); }
  };

  /* ======================= MARKETS (homepage) ======================= */
  const FEED = [['BTC', 'bitcoin', 'Bitcoin'], ['ETH', 'ethereum', 'Ethereum'], ['SOL', 'solana', 'Solana'], ['XRP', 'ripple', 'XRP'], ['DOGE', 'dogecoin', 'Dogecoin'], ['ADA', 'cardano', 'Cardano']];
  const fmtP = p => p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : p >= 1 ? p.toFixed(2) : p.toFixed(4);
  const chg = (c, sym) => `<span class="mk-chg ${c >= 0 ? 'up' : 'dn'}" ${sym ? `data-chg="${sym}"` : ''}>${c >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(c || 0).toFixed(2)}%</span>`;
  const spark = (arr, up, w = 120, h = 36) => { if (!arr || arr.length < 2) return ''; const mn = Math.min(...arr), mx = Math.max(...arr), r = (mx - mn) || 1; const d = arr.map((v, i) => `${i ? 'L' : 'M'}${(i / (arr.length - 1) * w).toFixed(1)} ${(h - 3 - (v - mn) / r * (h - 6)).toFixed(1)}`).join(' '); return `<svg class="mk-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="mk-sp" pathLength="1" d="${d}" fill="none" stroke="${up ? '#1a8f4d' : '#d14b3b'}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`; };
  let mkTimer = null, MK = null, range = '7D', ws = null, wsLive = false, monthly = null, lastDraw = 0, animateNext = true;
  const hourFmt = t => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const pts = c => { const n = c.series.length, end = new Date(MK.updated).getTime(), st = MK.stepMs || 3600e3; return c.series.map((v, i) => ({ t: end - (n - 1 - i) * st, v })); };
  const btcCoin = () => MK?.crypto.find(c => c.id === 'bitcoin') || MK?.crypto[0];
  const seriesForRange = () => { const c = btcCoin(); if (!c) return []; let p = pts(c); if (range === '24H') { const cut = p[p.length - 1].t - 24 * 3600e3; p = p.filter(x => x.t >= cut); } else if (range === '1M' && monthly) p = monthly.slice(); if (p.length) p[p.length - 1] = { t: Date.now(), v: c.price }; return p; };
  const drawChart = animate => {
    const svg = $('#mk-chart'); if (!svg) return; const s = seriesForRange(); if (s.length < 2) return; const up = s[s.length - 1].v >= s[0].v, col = up ? '#1a8f4d' : '#d14b3b';
    const W = 800, H = 290, PL = 8, PB = 26, mn = Math.min(...s.map(x => x.v)), mx = Math.max(...s.map(x => x.v)), r = (mx - mn) || 1;
    const X = i => PL + i / (s.length - 1) * (W - PL * 2), Y = v => H - PB - 8 - (v - mn) / r * (H - PB - 40);
    const d = s.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
    const grid = [0, 1, 2, 3].map(i => { const v = mn + r * (i / 3); return `<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e6ece9"/><text x="${W - 4}" y="${Y(v) - 5}" text-anchor="end" font-size="11" fill="#7a9096">$${fmtP(v)}</text>`; }).join('');
    const xl = [0, .5, 1].map((f, k) => { const i = Math.round(f * (s.length - 1)); return `<text x="${k === 0 ? 4 : k === 2 ? W - 4 : X(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}" font-size="11" fill="#7a9096">${new Date(s[i].t).toLocaleString('en-US', range === '24H' ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' })}</text>`; }).join('');
    const ex = X(s.length - 1), ey = Y(s[s.length - 1].v);
    svg.innerHTML = `${grid}${xl}<path d="${d} L${ex} ${H - PB} L${PL} ${H - PB}Z" fill="${col}" opacity="${animate ? 0 : .1}" class="${animate ? 'mk-area' : ''}"/><path d="${d}" pathLength="1" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" class="${animate ? 'mk-line' : ''}"/><g id="mk-h" style="display:none"><line id="mk-l" y1="0" y2="${H - PB}" stroke="#0c2f2c" stroke-opacity=".25"/><circle id="mk-c" r="5" fill="${col}" stroke="#fff" stroke-width="2"/></g><circle cx="${ex}" cy="${ey}" r="9" fill="${col}" opacity=".18" class="mk-pulse"/><circle cx="${ex}" cy="${ey}" r="4.5" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    const tip = $('#mk-tip'), h = $('#mk-h');
    const move = e => { const rc = svg.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - rc.left) / rc.width * W, i = Math.max(0, Math.min(s.length - 1, Math.round((x - PL) / (W - PL * 2) * (s.length - 1)))); h.style.display = ''; $('#mk-l').setAttribute('x1', X(i)); $('#mk-l').setAttribute('x2', X(i)); $('#mk-c').setAttribute('cx', X(i)); $('#mk-c').setAttribute('cy', Y(s[i].v)); tip.style.display = 'block'; tip.innerHTML = `<b>$${fmtP(s[i].v)}</b><small>${hourFmt(s[i].t)}</small>`; tip.style.left = Math.min(Math.max(X(i) / W * 100, 14), 86) + '%'; };
    svg.onmousemove = svg.ontouchmove = move; svg.onmouseleave = svg.ontouchend = () => { h.style.display = 'none'; tip.style.display = 'none'; };
  };
  const heroBtc = () => { const c = btcCoin(), f = $('.fc1'); if (c && f) f.innerHTML = `<small><i class="liveDot"></i>Bitcoin \u00b7 live</small><b data-px="BTC">$${fmtP(c.price)}</b>`; };
  const tick = (sym, price, open24) => {
    if (!MK) return; const c = MK.crypto.find(x => x.symbol === sym); if (!c || !(price > 0)) return; const prev = c.price; c.price = price; if (open24 > 0) c.change = (price / open24 - 1) * 100;
    $$(`[data-px="${sym}"]`).forEach(el => { el.textContent = (el.dataset.dollar === '0' ? '' : '$') + fmtP(price); el.classList.remove('flash-up', 'flash-dn'); void el.offsetWidth; el.classList.add(price >= prev ? 'flash-up' : 'flash-dn'); });
    $$(`[data-chg="${sym}"]`).forEach(el => { el.className = `mk-chg ${c.change >= 0 ? 'up' : 'dn'}`; el.textContent = `${c.change >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(c.change).toFixed(2)}%`; });
    if (sym === 'BTC') { const now = Date.now(); if (now - lastDraw > 900) { lastDraw = now; drawChart(false); } const st = $('#mk-st'); if (st) st.textContent = 'Live \u00b7 streaming'; }
  };
  const connectWS = () => {
    if (ws || !('WebSocket' in window)) return;
    try {
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      ws.onopen = () => { wsLive = true; ws.send(JSON.stringify({ type: 'subscribe', product_ids: FEED.map(f => f[0] + '-USD'), channels: ['ticker'] })); };
      ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.type === 'ticker' && m.price) tick(m.product_id.split('-')[0], Number(m.price), Number(m.open_24h)); } catch (x) { /* ignore */ } };
      ws.onclose = () => { ws = null; wsLive = false; if ($('#mk-root')) setTimeout(connectWS, 6000); };
      ws.onerror = () => { try { ws.close(); } catch (x) { /* ignore */ } };
    } catch (e) { ws = null; }
  };
  const browserCrypto = async () => {
    const syms = FEED.map(f => f[0]).join(',');
    try {
      const [p, ...h] = await Promise.all([fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${syms}&tsyms=USD`).then(r => r.json()), ...FEED.map(f => fetch(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${f[0]}&tsym=USD&limit=168`).then(r => r.json()))]);
      const list = FEED.map((f, i) => ({ id: f[1], symbol: f[0], name: f[2], price: p.RAW[f[0]].USD.PRICE, change: p.RAW[f[0]].USD.CHANGEPCT24HOUR, series: (h[i].Data?.Data || []).map(x => x.close) })); if (list.every(c => c.series.length > 5)) return { list, step: 3600e3, src: 'CryptoCompare' };
    } catch (e) { /* try next */ }
    try {
      const j = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + FEED.map(f => f[1]).join(',') + '&sparkline=true&price_change_percentage=24h').then(r => r.json());
      const list = j.map(c => ({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h, series: (c.sparkline_in_7d?.price || []).filter((_, i) => i % 2 === 0) })); if (list.length) return { list, step: 2 * 3600e3, src: 'CoinGecko' };
    } catch (e) { /* none */ }
    return null;
  };
  const loadMonthly = async () => { if (monthly) return; try { const j = await fetch('https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=30').then(r => r.json()); monthly = (j.Data?.Data || []).map(x => ({ t: x.time * 1000, v: x.close })); } catch (e) { const c = btcCoin(); monthly = c ? pts(c) : null; } };
  const renderMarkets = () => {
    if (!MK || !$('#mk-root')) return; const btc = btcCoin(), others = MK.crypto.filter(c => c !== btc);
    const src = MK.sources || { crypto: 'live', stocks: 'live' }, isSample = src.crypto === 'sample';
    $('#mk-root').innerHTML = `<div class="mk-top"><div class="mk-live ${isSample ? 'sample' : ''}"><i></i><span id="mk-st">${isSample ? 'Sample data' : wsLive ? 'Live \u00b7 streaming' : 'Live'}</span> \u00b7 ${isSample ? 'live feed unavailable' : 'crypto via ' + esc(src.crypto)}${src.stocks === 'sample' ? ' \u00b7 shares sample' : ''}</div></div>
      <div class="mk-grid"><article class="mk-main">${btc ? `<div class="mk-head"><div><span class="mk-coin">\u20bf</span><div><b>${esc(btc.name)}</b><small>${esc(btc.symbol)} / USD</small></div></div><div class="mk-pr"><strong data-px="BTC">$${fmtP(btc.price)}</strong>${chg(btc.change, 'BTC')}</div></div><div class="mk-tabs">${['24H', '7D', '1M'].map(r => `<button class="${r === range ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div><div class="mk-cw"><svg id="mk-chart" viewBox="0 0 800 290" preserveAspectRatio="none"></svg><div id="mk-tip" class="mk-tip"></div></div>` : '<p>Market data is unavailable right now.</p>'}</article>
      <div class="mk-side"><h3>Crypto</h3>${others.map(c => `<div class="mk-row"><div><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></div>${spark(c.series, c.change >= 0)}<div class="mk-num"><b data-px="${esc(c.symbol)}">$${fmtP(c.price)}</b>${chg(c.change, c.symbol)}</div></div>`).join('')}</div></div>
      <div class="mk-grid2"><div class="mk-card"><h3>Indices</h3>${MK.indices.map(c => `<div class="mk-row"><div><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></div>${spark(c.series, c.change >= 0)}<div class="mk-num"><b>${fmtP(c.price)}</b>${chg(c.change)}</div></div>`).join('')}</div>
      <div class="mk-card"><h3>Popular shares</h3>${MK.stocks.map(c => `<div class="mk-row"><div><b>${esc(c.symbol)}</b><small>${esc(c.name)}</small></div>${spark(c.series, c.change >= 0)}<div class="mk-num"><b>$${fmtP(c.price)}</b>${chg(c.change)}</div></div>`).join('')}</div></div>
      <p class="mk-note">Market data from public feeds (CoinGecko, CryptoCompare, Coinbase, Yahoo Finance, Stooq), delayed for shares and for information only. Mountain Hills shares and offer trading or investment advice.</p>`;
    $$('.mk-tabs button').forEach(b => b.onclick = async () => { range = b.dataset.r; if (range === '1M') await loadMonthly(); animateNext = true; renderMarkets(); });
    drawChart(animateNext); animateNext = false; heroBtc();
    const tk = $('.ticker div'); if (tk) { const items = [...MK.crypto.slice(0, 4), ...MK.indices, ...MK.stocks.slice(0, 4)].map(c => `<span class="tk"><b>${esc(c.symbol)}</b> ${fmtP(c.price)} <em class="${c.change >= 0 ? 'up' : 'dn'}">${c.change >= 0 ? '+' : ''}${(c.change || 0).toFixed(2)}%</em></span>`).join(''); tk.innerHTML = items + items; tk.classList.add('live'); }
  };
  const loadMk = async () => {
    try {
      MK = await (await fetch('/api/market')).json();
      if (!MK.crypto?.length || (MK.sources?.crypto === 'sample')) { const b = await browserCrypto(); if (b) { MK.crypto = b.list; MK.stepMs = b.step; MK.sources = { ...(MK.sources || {}), crypto: b.src }; MK.updated = new Date().toISOString(); } }
    } catch (e) { const b = await browserCrypto(); if (!b) return; MK = { source: 'live', updated: new Date().toISOString(), stepMs: b.step, sources: { crypto: b.src, stocks: 'sample' }, crypto: b.list, indices: [], stocks: [] }; }
    const live = wsLive; renderMarkets(); if (live) { const st = $('#mk-st'); if (st) st.textContent = 'Live \u00b7 streaming'; } connectWS();
  };

  const RATES = [['Growth Savings', '4.35%', 'APY', 'No minimum balance'], ['12-month Certificate', '4.60%', 'APY', 'Minimum $1,000'], ['Auto loan', '5.99%', 'APR', 'New and used vehicles'], ['30-year Mortgage', '6.25%', 'APR', 'Fixed rate']];
  const baseHome = window.home;
  window.home = (...a) => {
    baseHome(...a); clearInterval(mkTimer);
    const dark = $('.psec.dark'); if (!dark || $('#markets')) return;
    dark.insertAdjacentHTML('afterend', `<section class="psec mk" id="markets"><span class="eyebrow2">Markets</span><h2>Keep an eye on <em>the markets.</em></h2><p class="lede">Live prices for Bitcoin and other crypto, major indices and popular shares, right on your banking home.</p><div id="mk-root" class="mk-root"><p class="muted">Loading live prices\u2026</p></div></section>
      <section class="psec rates" id="rates"><span class="eyebrow2">Rates</span><h2>Rates that <em>work for you.</em></h2><div class="rates-grid">${RATES.map(r => `<div class="rate"><small>${r[0]}</small><strong>${r[1]}</strong><span>${r[2]}</span><p>${r[3]}</p></div>`).join('')}</div><p class="mk-note">Mountain Hills Credit Union offers of credit..</p></section>`);
    $$('.pnav nav, .pmobile').forEach(n => { const first = n.querySelector('a'); if (first && !n.querySelector('[data-mk]')) first.insertAdjacentHTML('afterend', '<a data-mk onclick="aurumGo(\'markets\')">Markets</a>'); });
    loadMk(); mkTimer = setInterval(() => { if ($('#mk-root')) loadMk(); else clearInterval(mkTimer); }, 60000);
  };

  /* ======================= INSTALL (iOS / Android / desktop) ======================= */
  const ua = navigator.userAgent, isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), isAndroid = /Android/i.test(ua);
  window.installApp = async (kind) => {
    if (window.__bip && (!kind || kind === 'auto' || (kind === 'android' && !isIOS) || kind === 'desktop')) { window.__bip.prompt(); try { await window.__bip.userChoice; } catch (e) { /* ignore */ } window.__bip = null; return; }
    const k = kind && kind !== 'auto' ? kind : isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
    const steps = { ios: ['Open this site in <b>Safari</b>.', 'Tap the <b>Share</b> button (square with an arrow).', 'Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.'], android: ['Open this site in <b>Chrome</b>.', 'Tap the <b>\u22ee menu</b> at the top right.', 'Tap <b>Install app</b> (or <b>Add to Home screen</b>).'], desktop: ['Use <b>Chrome</b> or <b>Edge</b>.', 'Click the <b>install icon</b> at the right end of the address bar, or open the browser menu.', 'Choose <b>Install Mountain Hills</b>.'] };
    closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2" style="z-index:350"><div><div class="topline"><h2>Install on ${k === 'ios' ? 'iPhone / iPad' : k === 'android' ? 'Android' : 'your computer'}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div><img src="/icon-192.png" alt="" style="width:72px;border-radius:18px;margin:6px 0 4px"><ol class="steps-i">${steps[k].map(s => `<li>${s}</li>`).join('')}</ol><p class="muted" style="font-size:13px;margin-top:14px">The app opens full screen with its own icon, just like a store app.</p></div></div>`);
  };
  const AP = '<svg viewBox="0 0 24 24"><path d="M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zm0 2v16h8V4h-1.500l-.5 1h-4l-.5-1zm4 14a1 1 0 100 2 1 1 0 000-2z"/></svg>';
  const GP = '<svg viewBox="0 0 24 24"><path d="M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zm0 3v13h8V5zm4 15.500a.8.8 0 100 1.600.8.8 0 000-1.600z"/></svg>';
  const DT = '<svg viewBox="0 0 24 24"><path d="M3 4h18a1 1 0 011 1v11a1 1 0 01-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v9h16V6z"/></svg>';
  const baseHome2 = window.home;
  window.home = (...a) => {
    baseHome2(...a);
    if ($('#locations')) return;
    // utility bar
    if (!$('.util')) document.body.insertAdjacentHTML('afterbegin', `<div class="util"><div><a class="on">Personal</a><a>Business</a><a>Wealth</a><a onclick="aurumGo('rates')">Rates</a></div><div><a>Routing no. ${window.MH_ROUTING || ''}</a><a onclick="aurumGo('locations')">Locations</a><a>Help 1-202-202-4033</a><a>Security Center</a></div></div>`);
    const nav = $('#pnav'), util = $('.util'); const sc = () => { util?.classList.toggle('hide', scrollY > 30); }; sc(); addEventListener('scroll', sc, { passive: true });
    const rates = $('#rates');
    rates?.insertAdjacentHTML('afterend', `<section class="psec mk" id="locations"><span class="eyebrow2">Branches &amp; ATMs</span><h2>Always <em>close by.</em></h2><p class="lede">Find a branch, a surcharge-free ATM, or a banker to talk to. </p>
      <div class="loc-grid"><div class="map"><svg viewBox="0 0 600 340" preserveAspectRatio="xMidYMid slice"><rect width="600" height="340" fill="#e6eee8"/><g stroke="#fff" stroke-width="14" fill="none"><path d="M-10 90 L610 150"/><path d="M-10 250 L610 220"/><path d="M120 -10 L180 350"/><path d="M380 -10 L330 350"/><path d="M520 -10 L560 350"/></g><g stroke="#d3dfd6" stroke-width="3" fill="none"><path d="M-10 170 L610 190"/><path d="M250 -10 L260 350"/><path d="M450 -10 L470 350"/></g><path d="M-10 300 Q200 260 320 310 T610 290 V350 H-10Z" fill="#cfe3dc"/><rect x="60" y="30" width="90" height="60" rx="10" fill="#d9e7d5"/><rect x="400" y="230" width="110" height="70" rx="10" fill="#d9e7d5"/></svg><div class="pin" style="left:30%;top:36%"><span></span></div><div class="pin" style="left:62%;top:52%"><span></span></div><div class="pin" style="left:48%;top:26%"><span></span></div><div class="pin" style="left:78%;top:70%"><span></span></div></div>
      <div class="locs">${[['Main Branch', '100 Summit Avenue, Denver, CO 80202', 'Mon\u2013Fri 9am\u20136pm \u00b7 Sat 9am\u20131pm', 'Open now'], ['Cherry Creek Branch', '250 Fillmore Street, Denver, CO 80206', 'Mon\u2013Fri 9am\u20135pm', 'ATM 24/7'], ['Boulder Branch', '1800 Pearl Street, Boulder, CO 80302', 'Mon\u2013Fri 9am\u20135pm \u00b7 Sat 9am\u201312pm', 'Business banking'], ['Highlands Ranch ATM', '9100 Town Center Drive, CO 80129', 'Open 24 hours', 'Surcharge-free']].map(l => `<div class="loc"><b>${l[0]}</b><small>${l[1]}<br>${l[2]}</small><span class="tag">${l[3]}</span></div>`).join('')}</div></div></section>
      <section class="psec dark" id="app"><div class="getapp"><div><span class="eyebrow2">Mobile banking</span><h2>Bank anywhere. <em>Install the app.</em></h2><p class="lede">Add Mountain Hills to your home screen on iPhone, Android or your computer. It opens full screen with its own icon and works like a store app.</p><div class="apps"><button class="appbtn" onclick="installApp('ios')">${AP}<div><small>Install on</small><b>iPhone / iPad</b></div></button><button class="appbtn" onclick="installApp('android')">${GP}<div><small>Install on</small><b>Android</b></div></button><button class="appbtn" onclick="installApp('desktop')">${DT}<div><small>Install on</small><b>Computer</b></div></button></div></div><div class="pic"><img class="ico2" src="/icon-512.png" alt="Mountain Hills app icon"></div></div></section>`);
    // richer footer
    const legal = $('.pfoot .legal'); if (legal && !$('.foot-links')) legal.insertAdjacentHTML('beforebegin', `<div class="fneed"><div>Customer care<b>1-202-202-4033</b></div><div>Lost or stolen card<b>1-800-555-0199</b></div><div>Routing number<b>${window.MH_ROUTING || ''}</b></div></div><div class="foot-links"><a>Privacy</a><a>Terms of use</a><a>Accessibility</a><a>Security Center</a><a>Fee schedule</a><a>Site map</a><a>Careers</a></div>`);
    $$('.pnav nav, .pmobile').forEach(n => { if (!n.querySelector('[data-loc]')) n.insertAdjacentHTML('beforeend', '<a data-loc onclick="aurumGo(\'locations\')">Locations</a>'); });
  };
  if (location.pathname !== '/admin' && !state.user && $('.phero')) home();
}, 0);
