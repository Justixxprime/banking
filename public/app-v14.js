// v14: header-strip fix, international wires (customer flow) and admin international controls.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const W = window.MH_WORLD, post = (u, b, m = 'POST') => api(u, { method: m, body: JSON.stringify(b) });

  /* ---------- 1. The public utility strip only belongs on the public site ---------- */
  const tidy = () => { const pub = !!document.getElementById('pnav'); if (!pub) $$('.util').forEach(u => u.remove()); document.body.classList.toggle('in-app', !!$('.shell2')); };
  new MutationObserver(tidy).observe(app, { childList: true }); tidy();


  /* ---------- 1b. Scrolling safety net (mouse wheel / trackpad) ---------- */
  const unlock = () => { if (!$('.tf') && !$('.modal-v2') && !$('.xfer-back') && !$('.pal')) { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; } $$('.is-leaving').forEach(e => { if (!e.dataset.lv) e.dataset.lv = Date.now(); else if (Date.now() - e.dataset.lv > 1500) e.classList.remove('is-leaving'); }); };
  setInterval(unlock, 800); addEventListener('load', unlock); addEventListener('pageshow', unlock);

  /* ---------- 1c. Two logo slots just above the fictional-brand notice, on every page ---------- */
  const LOGOS = `<div class="foot-logos" aria-label="Partners and affiliations"><img src="/logos/logo-1.svg" alt="Logo 1" loading="lazy" onerror="this.onerror=function(){this.remove()};this.src='/logos/logo-1.png'"><img src="/logos/logo-2.svg" alt="Logo 2" loading="lazy" onerror="this.onerror=function(){this.remove()};this.src='/logos/logo-2.png'"></div>`;
  const putLogos = () => { $$('.pfoot .legal, .ft2 .ft2-legal, .lgn-legal, .legal-note').forEach(l => { if (!l.previousElementSibling?.classList.contains('foot-logos')) l.insertAdjacentHTML('beforebegin', LOGOS); }); };
  new MutationObserver(putLogos).observe(app, { childList: true, subtree: true }); putLogos();

  if (!W) return;
  const fc = (v, c) => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: W.ZERO_DEC.includes(c) ? 0 : 2 }).format(Number(v)); } catch { return `${Number(v).toFixed(2)} ${c}`; } };
  const num = v => { const n = Number(String(v || '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
  const mask = n => `•••• ${String(n || '').slice(-4)}`;
  const avail = a => { const v = Number(a.available_balance) - Number(a.held || 0); return Number.isFinite(v) ? v : Number(a.available_balance); };
  const AV = ['#cde8a4', '#9fd8cc', '#f1d38a', '#f4b3a3', '#b7cdf5', '#d9c2f0'];
  const avColor = s => AV[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  const ratef = r => Number(r).toLocaleString('en-US', { maximumSignificantDigits: 6 });
  let I = null;
  const shut = () => { $('.tf')?.remove(); document.body.style.overflow = ''; I = null; removeEventListener('keydown', esc1); };
  const esc1 = e => { if (e.key === 'Escape' && I && I.step < 4) shut(); };
  const acct = () => I.accounts.find(a => a.id === I.d.accountId) || I.accounts[0];
  const setStep = (n, title) => { I.step = n; $('#tf-t').textContent = title; $$('.tf-prog i').forEach((i, k) => i.classList.toggle('on', k < Math.min(n, 4))); const b = $('#tf-b'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; b.scrollTop = 0; };
  const seg = which => `<div class="tf-seg" role="tablist"><button type="button" data-w="d" class="${which === 'd' ? 'on' : ''}">Domestic</button><button type="button" data-w="i" class="${which === 'i' ? 'on' : ''}">International</button></div>`;
  const hookSeg = which => $$('.tf-seg button').forEach(b => b.onclick = () => { if (b.dataset.w === which) return; shut(); b.dataset.w === 'i' ? openIntl() : openTransfer(); });

  // Domestic flow: add the Domestic | International switch once its sheet is on screen.
  const baseOpen = window.openTransfer;
  window.openTransfer = async (...a) => { await baseOpen(...a); const h = $('.tf .tf-head'); if (h && !$('.tf-seg')) { h.insertAdjacentHTML('afterend', seg('d')); hookSeg('d'); } };

  window.openIntl = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      const opts = await api('/api/customer/intl-options');
      if (!opts.enabled) return toast('International wires are not available right now. Please contact support.');
      const accounts = state.data.accounts.filter(a => (!a.status || a.status === 'ACTIVE') && !opts.blocked.includes(a.id)).map(a => ({ ...a, available_balance: avail(a) }));
      if (!accounts.length) return toast('International wires are not available on your accounts right now. Please contact support.');
      I = { opts, accounts, step: 1, d: { accountId: accounts.find(a => a.id === state.account?.id)?.id || accounts[0].id, amount: '', cc: '', name: '', addr: '', bank: '', type: '', bic: '', iban: '', purpose: 'Family support', charges: 'SHA', note: '' } };
      $('.tf')?.remove(); document.body.style.overflow = 'hidden';
      document.body.insertAdjacentHTML('beforeend', `<div class="tf" role="dialog" aria-modal="true"><section class="tf-stage"><div class="wm">Mountain Hills</div><div><h2 id="tf-h">Send money <em>worldwide.</em></h2><p id="tf-p">Wire dollars to a bank in ${W.countries.length} countries. We convert to the local currency and show every cost before you confirm.</p><div class="tf-route"><div class="node" id="n-from"><small>From</small><div><b id="pv-from"></b><span class="bl" id="pv-bal"></span></div></div><div class="line"></div><div class="node" id="n-to"><span class="rav" id="pv-av">🌐</span><div><small>To</small><b id="pv-to">Beneficiary</b></div></div></div><div class="tf-amount" id="pv-amt"><span>$</span>0.00</div><div class="fx-pill" id="pv-fx"></div></div><div></div></section><section class="tf-sheet"><div class="tf-head"><h3 id="tf-t">International wire</h3><button class="tf-x" id="tf-x" aria-label="Close">✕</button></div>${seg('i')}<div class="tf-prog"><i></i><i></i><i></i><i></i></div><div class="tf-body" id="tf-b"></div></section></div>`);
      $('#tf-x').onclick = shut; addEventListener('keydown', esc1); hookSeg('i'); preview(); stepDetails();
    } catch (e) { toast(e.message); }
  };
  const country = () => W.byCode(I.d.cc);
  const preview = () => {
    if (!I) return; const d = I.d, a = acct(), c = country(), v = num(d.amount);
    $('#pv-from').textContent = a.name; $('#pv-bal').textContent = `${mask(a.account_number)} · ${money(a.available_balance)}`;
    $('#pv-to').textContent = d.name || (c ? c.name : 'Beneficiary'); const av = $('#pv-av'); av.textContent = d.name ? d.name[0].toUpperCase() : (c ? W.flag(c.code) : '🌐'); av.style.background = d.name ? avColor(d.name) : '#ffffff1a'; $('#n-to').classList.toggle('lit', !!(d.name || c));
    $('#pv-amt').innerHTML = `<span>$</span>${v ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
    const r = c && I.opts.rates[c.currency]; $('#pv-fx').textContent = r ? (v ? `≈ ${fc(v * r.rate, c.currency)}` : `1 USD = ${ratef(r.rate)} ${c.currency}`) : '';
  };
  const feeNow = () => I.opts.fee + (I.d.charges === 'OUR' ? I.opts.our : 0);
  const banksFor = cc => { const base = (W.byCode(cc)?.banks || []).map(b => ({ ...b, bic: W.bic(b.name, cc) })); const extra = (I.opts.customBanks || []).filter(b => b.country === cc).map(b => ({ name: b.name, type: b.type, bic: b.bic || W.bic(b.name, cc) })); return [...extra, ...base]; };

  function stepDetails() {
    const d = I.d; setStep(1, 'International wire');
    const regions = [...new Set(W.countries.map(c => c.region))];
    const cOpts = c => `<option value="${c.code}" ${d.cc === c.code ? 'selected' : ''} ${I.opts.disabled.includes(c.code) ? 'disabled' : ''}>${W.flag(c.code)} ${esc(c.name)} · ${c.currency}${I.opts.disabled.includes(c.code) ? ' (unavailable)' : ''}</option>`;
    $('#tf-b').innerHTML = `<form id="tf-f" novalidate>
      <span class="tf-lab">From</span><div class="tf-from">${I.accounts.map(a => `<button type="button" data-id="${a.id}" class="${a.id === d.accountId ? 'on' : ''}"><span class="rd"></span><div><b>${esc(a.name)}</b><small>${esc(mask(a.account_number))} · ${esc(a.account_type)}</small></div><strong>${money(a.available_balance)}</strong></button>`).join('')}</div>
      <span class="tf-lab">Destination country</span><div class="f" style="margin-top:0"><select name="cc"><option value="">Choose a country…</option>${regions.map(r => `<optgroup label="${esc(r)}">${W.countries.filter(c => c.region === r).map(cOpts).join('')}</optgroup>`).join('')}</select></div>
      <span class="tf-lab">You send (USD)</span><div class="amt-in"><span>$</span><input id="tf-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(d.amount)}"></div><div class="tf-err" id="tf-err"></div>
      <div class="fxbox" id="fxbox"></div>
      <span class="tf-lab">Beneficiary</span>
      <div class="f" style="margin-top:0"><label>Full name (as on the account)</label><input name="rname" autocomplete="off" maxlength="80" value="${esc(d.name)}" placeholder="e.g. Elena Marchetti"></div>
      <div class="f"><label>Address (street, city, country)</label><input name="addr" autocomplete="off" maxlength="120" value="${esc(d.addr)}" placeholder="e.g. 12 Via Roma, Milan, Italy"></div>
      <span class="tf-lab">Beneficiary bank</span>
      <div id="bank-sec"></div>
      <div class="f"><label>Purpose of payment</label><select name="purpose">${['Family support', 'Tuition & education', 'Goods or services', 'Property or rent', 'Investment', 'Salary or contractor', 'Gift', 'Other'].map(p => `<option ${d.purpose === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <span class="tf-lab">Who pays the bank charges?</span><div class="meth chg"><button type="button" data-c="SHA"><b>Shared (SHA)</b><small>You pay our fee; the receiving bank may deduct theirs</small></button><button type="button" data-c="OUR"><b>You pay all (OUR)</b><small>+ ${money(I.opts.our)} so the full amount arrives</small></button></div>
      <div class="f"><label>Message to beneficiary <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="note" maxlength="60" value="${esc(d.note)}" placeholder="Reference shown on their statement"></div>
      <div class="tf-ferr" id="tf-ferr" role="alert"></div><button class="tf-cta" type="submit">Review wire</button></form>`;
    const f = $('#tf-f'), amt = $('#tf-amt'), err = $('#tf-err');
    if (I.flash) { $('#tf-ferr').textContent = I.flash; I.flash = ''; }
    const fxPaint = () => {
      const c = country(), box = $('#fxbox'), v = num(d.amount); if (!c) { box.innerHTML = '<div class="fx-empty">Choose a country to see today’s exchange rate.</div>'; return; }
      const r = I.opts.rates[c.currency], fee = feeNow(); if (!r) { box.innerHTML = '<div class="fx-empty">That currency isn’t available right now.</div>'; return; }
      box.innerHTML = `<div class="fx-top"><span>${W.flag(c.code)} ${esc(c.name)}</span><b>1 USD = ${ratef(r.rate)} ${c.currency}</b></div><div class="fx-get"><small>Beneficiary receives</small><strong>${v ? fc(v * r.rate, c.currency) : '—'}</strong></div><div class="fx-rows"><div><span>Mid-market rate</span><b>${ratef(r.mid)}</b></div><div><span>Our margin</span><b>${I.opts.markup}%</b></div><div><span>Wire fee</span><b>${money(fee)}</b></div><div><span>Total debited</span><b>${v ? money(v + fee) : '—'}</b></div></div><small class="fx-src">${I.opts.source === 'live' ? 'Live rates' : 'Indicative rates'} · the rate in effect when you send is applied</small>`;
    };
    const bankSec = () => {
      const c = country(), sec = $('#bank-sec'); if (!c) { sec.innerHTML = '<div class="fx-empty">Choose a destination country first.</div>'; return; }
      const list = banksFor(c.code), types = [...new Set(list.map(b => b.type))];
      sec.innerHTML = `<div class="chips btypes" id="bt">${['All', ...types].map((t, i) => `<button type="button" data-t="${esc(t)}" class="${(d.filter || 'All') === t ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>
        <div class="f"><label>Bank <small style="font-weight:400;color:var(--soft)">${list.length} banks in ${esc(c.name)}</small></label><div class="combo" id="cb"><input name="bank" autocomplete="off" maxlength="60" value="${esc(d.bank)}" placeholder="Search ${esc(c.name)} banks"><div class="list"></div></div><div class="rv ok" id="btype" style="${d.type ? '' : 'display:none'}">${esc(d.type)}</div></div>
        <div class="f"><label>SWIFT / BIC code</label><input name="bic" autocomplete="off" maxlength="11" value="${esc(d.bic)}" placeholder="8 or 11 characters" style="text-transform:uppercase"><div class="rv" id="bicv"></div></div>
        <div class="f"><label>${c.iban ? 'IBAN' : 'Account number'}</label><input name="iban" autocomplete="off" maxlength="${c.iban ? c.iban + 8 : 30}" value="${esc(d.iban)}" placeholder="${c.iban ? c.code + '00 0000 0000 … (' + c.iban + ' characters)' : 'Beneficiary account number'}" style="text-transform:uppercase"><div class="rv" id="ibv"></div>${c.iban ? '<button type="button" class="tf-ghost" id="sample" style="margin:6px 0 0;padding:6px 0;text-align:left;color:var(--g600);font-weight:700">Use a sample IBAN for this demo</button>' : ''}</div>`;
      const el = f.elements, cb = $('#cb'), li = $('.list', cb), bi = el.bank;
      const draw = () => { const q = bi.value.trim().toLowerCase(), t = d.filter || 'All'; const m = list.filter(b => (t === 'All' || b.type === t) && b.name.toLowerCase().includes(q)).slice(0, 14); li.innerHTML = m.map(b => `<div class="opt" data-b="${esc(b.name)}"><span class="bav" style="background:${avColor(b.name)}">${esc(b.name[0])}</span><span>${esc(b.name)}<small class="bty">${esc(b.type)}</small></span></div>`).join('') || '<div class="opt"><span>No match – type the bank name and its SWIFT code</span></div>'; cb.classList.toggle('open', document.activeElement === bi); $$('.opt[data-b]', li).forEach(o => o.onmousedown = e => { e.preventDefault(); const b = list.find(x => x.name === o.dataset.b); bi.value = d.bank = b.name; d.type = b.type; el.bic.value = d.bic = b.bic; $('#btype').textContent = b.type; $('#btype').style.display = ''; cb.classList.remove('open'); chkBic(); }); };
      bi.onfocus = bi.oninput = () => { d.bank = bi.value; const b = list.find(x => x.name === bi.value); d.type = b ? b.type : d.type; draw(); }; bi.onblur = () => cb.classList.remove('open');
      $$('#bt button').forEach(b => b.onclick = () => { d.filter = b.dataset.t; $$('#bt button').forEach(x => x.classList.toggle('on', x === b)); bi.focus(); draw(); });
      const chkBic = () => { const v = el.bic.value.trim().toUpperCase(); d.bic = v; const o = $('#bicv'); if (!v) { o.textContent = ''; o.className = 'rv'; return; } if (W.bicOk(v)) { o.textContent = '✓ Valid SWIFT/BIC format' + (v.slice(4, 6) !== c.code ? ` · country code ${v.slice(4, 6)} doesn’t match ${c.code}` : ''); o.className = 'rv ok'; } else { o.textContent = '✕ A SWIFT/BIC is 8 or 11 letters and digits'; o.className = 'rv bad'; } };
      const chkIban = () => { const v = el.iban.value.replace(/\s+/g, '').toUpperCase(); d.iban = v; const o = $('#ibv'); if (!v) { o.textContent = ''; o.className = 'rv'; return; } if (W.ibanOk(v, c.code)) { o.textContent = c.iban ? '✓ Valid IBAN' : '✓ Account number looks right'; o.className = 'rv ok'; } else { o.textContent = c.iban ? `✕ ${c.name} IBANs start with ${c.code} and have ${c.iban} characters` : '✕ Enter 6–30 letters or digits'; o.className = 'rv bad'; } };
      el.bic.oninput = chkBic; el.iban.oninput = chkIban; chkBic(); chkIban();
      $('#sample') && ($('#sample').onclick = () => { el.iban.value = W.sampleIban(c.code, Date.now() % 9999999); chkIban(); });
    };
    $$('.tf-from button').forEach(b => b.onclick = () => { d.accountId = Number(b.dataset.id); $$('.tf-from button').forEach(x => x.classList.toggle('on', x === b)); preview(); });
    const cg = () => $$('.chg button').forEach(b => b.classList.toggle('on', b.dataset.c === d.charges)); cg();
    $$('.chg button').forEach(b => b.onclick = () => { d.charges = b.dataset.c; cg(); fxPaint(); });
    f.elements.cc.onchange = () => { d.cc = f.elements.cc.value; d.bank = d.type = d.bic = d.iban = ''; d.filter = 'All'; fxPaint(); bankSec(); preview(); };
    amt.oninput = () => { let v = amt.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); if (p.length > 2) v = p[0] + '.' + p.slice(1).join(''); const [i, fr] = v.split('.'); amt.value = (i ? Number(i).toLocaleString('en-US') : '') + (fr !== undefined ? '.' + fr.slice(0, 2) : ''); d.amount = amt.value; err.textContent = ''; preview(); fxPaint(); };
    f.elements.rname.oninput = () => { d.name = f.elements.rname.value; preview(); };
    fxPaint(); bankSec();
    f.onsubmit = e => {
      e.preventDefault(); const el = f.elements; Object.assign(d, { name: el.rname.value.trim(), addr: el.addr.value.trim(), purpose: el.purpose.value, note: el.note.value.trim(), amount: amt.value }); const c = country();
      const fe = m => { const x = $('#tf-ferr'); x.textContent = m; x.classList.remove('shake'); void x.offsetWidth; x.classList.add('shake'); x.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (!c) return fe('Choose the destination country.'); if (I.opts.disabled.includes(c.code)) return fe('We can’t send wires to that country right now.');
      const v = num(amt.value); if (!(v > 0)) { err.textContent = 'Enter an amount to send.'; return amt.focus(); }
      if (v < I.opts.min) { err.textContent = `International wires start at ${money(I.opts.min)}.`; return amt.focus(); }
      if (I.opts.max > 0 && v > I.opts.max) { err.textContent = `International wires are limited to ${money(I.opts.max)} each.`; return amt.focus(); }
      if (v + feeNow() > Number(acct().available_balance)) { err.textContent = 'That is more than the available balance in this account, including the wire fee.'; return amt.focus(); }
      if (d.name.length < 2) return fe('Enter the beneficiary’s full name.'); if (d.addr.length < 5) return fe('Enter the beneficiary’s address.');
      d.bank = el.bank.value.trim(); d.bic = el.bic.value.trim().toUpperCase(); d.iban = el.iban.value.replace(/\s+/g, '').toUpperCase();
      if (!d.bank) return fe('Choose or type the beneficiary’s bank.'); if (!W.bicOk(d.bic)) return fe('Enter a valid SWIFT/BIC code. Picking the bank from the list fills it in.');
      if (!W.ibanOk(d.iban, c.code)) return fe(c.iban ? `Enter a valid ${c.name} IBAN. Tap “Use a sample IBAN” for the demo.` : 'Enter the beneficiary’s account number.');
      d.value = Math.round(v * 100) / 100; d.rate = I.opts.rates[c.currency].rate; d.cur = c.currency; d.dest = W.ZERO_DEC.includes(d.cur) ? Math.round(d.value * d.rate) : Math.round(d.value * d.rate * 100) / 100; d.fee = feeNow(); stepReview();
    };
  }

  function stepReview() {
    const d = I.d, a = acct(), c = country(), r = (k, v, cl = '') => `<div class="r ${cl}"><span>${k}</span><b>${v}</b></div>`;
    d.isNew = !(state.data.transactions || []).some(t => t.recipient_account === d.iban);
    setStep(2, 'Review wire');
    $('#tf-b').innerHTML = `<div class="center" style="margin-bottom:18px"><small class="tf-lab" style="margin:0 0 8px">Beneficiary receives</small><div class="res-amt">${fc(d.dest, d.cur)}</div><span class="muted">${money(d.value)} converted at 1 USD = ${ratef(d.rate)} ${d.cur}</span></div>
      <div class="tk">${r('Beneficiary', esc(d.name))}${r('Address', esc(d.addr))}${r('Country', `${W.flag(c.code)} ${esc(c.name)}`)}${r('Bank', esc(d.bank))}${d.type ? r('Bank type', esc(d.type)) : ''}${r('SWIFT / BIC', esc(d.bic))}${r(c.iban ? 'IBAN' : 'Account no.', esc(d.iban))}${r('From', `${esc(a.name)} ${esc(mask(a.account_number))}`)}${r('Purpose', esc(d.purpose))}${d.note ? r('Message', esc(d.note)) : ''}${r('Bank charges', d.charges === 'OUR' ? 'You pay all (OUR)' : 'Shared (SHA)')}${r('Expected arrival', '1–3 business days')}${r('You send', money(d.value))}${r('Wire fee', money(d.fee))}${r('Total debited', money(d.value + d.fee), 't')}</div>
      ${d.isNew ? `<label class="newr"><input type="checkbox" id="new-ok"><span><b>New beneficiary.</b> You haven’t wired ${esc(d.name)} before. International wires are hard to recall. Only send to people you know and trust.</span></label>` : ''}${d.value >= 10000 ? '<div class="review-note" style="margin-top:12px">Wires of $10,000 or more may be reviewed before they are released.</div>' : ''}
      <p class="muted" style="font-size:13px;line-height:1.55;margin:16px 2px 0">The receiving bank or an intermediary bank may deduct additional charges when charges are shared. Check the details carefully – wires sent to the wrong account may not be recoverable.</p><div class="tf-err" id="rv-err"></div>
      <button class="tf-cta" id="tf-go1">Continue</button><button class="tf-ghost" id="tf-edit">Edit details</button>`;
    $('#tf-edit').onclick = stepDetails; $('#tf-go1').onclick = () => { if (d.isNew && !$('#new-ok').checked) { $('#rv-err').textContent = 'Please confirm you know and trust this beneficiary first.'; return; } stepAuth(); };
  }

  function stepAuth(errMsg) {
    setStep(3, 'Enter your transfer PIN');
    $('#tf-b').innerHTML = `<div class="center"><div class="lockb"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div><h3 style="margin:0 0 8px;font-size:22px;letter-spacing:-.03em">Enter your transfer PIN</h3><p class="muted" style="line-height:1.55;margin:0">Enter your 6-digit transfer PIN to approve this ${money(I.d.value)} wire to ${esc(country().name)}. Don’t know it? Contact support.</p></div>
      <div class="otp2" id="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1}">`).join('')}</div><div class="tf-ferr center" id="tf-perr" role="alert">${esc(errMsg || '')}</div><button class="tf-cta" id="tf-go" disabled>Confirm and send</button><button class="tf-ghost" id="tf-back">Back to review</button>`;
    const bx = $$('#otp input'), go = $('#tf-go'), sync = () => go.disabled = bx.some(b => !b.value);
    bx.forEach((b, i) => { b.oninput = () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && bx[i + 1]) bx[i + 1].focus(); sync(); }; b.onkeydown = e => { if (e.key === 'Backspace' && !b.value && bx[i - 1]) bx[i - 1].focus(); if (e.key === 'Enter' && !go.disabled) go.click(); }; b.onpaste = e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); [...t].forEach((c, k) => bx[k].value = c); bx[Math.min(t.length, 5)].focus(); sync(); }; });
    bx[0].focus(); $('#tf-back').onclick = stepReview; go.onclick = () => { I.pin = bx.map(b => b.value).join(''); send(); };
  }

  async function send() {
    const d = I.d, c = country(), steps = ['Verifying your PIN', 'Checking available funds', `Converting USD to ${d.cur}`, 'Screening the payment', `Sending via SWIFT to ${d.bank}`];
    setStep(4, 'Sending'); $('.tf').classList.add('sending'); $('#n-from').classList.add('lit');
    $('#tf-h').innerHTML = 'Sending <em>securely.</em>'; $('#tf-p').textContent = 'Your wire is being processed. This only takes a moment.';
    $('#tf-b').innerHTML = `<div class="center"><div class="ring"><svg viewBox="0 0 110 110"><circle class="bg" cx="55" cy="55" r="50"/><circle class="fg" id="rg" cx="55" cy="55" r="50"/></svg><b id="pc">0%</b></div><div class="rail4" id="r4"><span><i></i>You</span><span><i></i>Mountain Hills</span><span><i></i>SWIFT network</span><span><i></i>${esc(c.name)}</span></div><h3 style="margin:0;font-size:22px">Processing your wire</h3><p class="muted" style="margin:6px 0 0">Please keep this window open.</p><ul class="pl" id="pl">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    const li = $$('#pl li'); let k = 0; const paint = () => { li.forEach((x, i) => { x.classList.toggle('done', i < k); x.classList.toggle('on', i === k); }); const p = Math.min(100, Math.round(k / li.length * 100)); $('#rg').style.strokeDashoffset = 314 - 314 * p / 100; $('#pc').textContent = p + '%'; $$('#r4 span').forEach((x, i) => x.classList.toggle('on', i <= Math.round(k / li.length * 3))); const r4 = $('#r4'); if (r4) r4.style.setProperty('--p', Math.min(100, k / li.length * 100) + '%'); };
    paint(); const iv = setInterval(() => { if (k < li.length) { k++; paint(); } }, 750);
    const body = { pin: I.pin, method: 'intl', accountId: d.accountId, country: d.cc, bankName: d.bank, bankType: d.type, swiftBic: d.bic, iban: d.iban, beneficiaryAddress: d.addr, charges: d.charges, recipientName: d.name, amount: d.value, description: ['International wire', d.purpose, d.note].filter(Boolean).join(' · ') };
    const call = api('/api/customer/transfers', { method: 'POST', body: JSON.stringify(body) }).then(r => ({ r }), e => ({ e }));
    const [o] = await Promise.all([call, new Promise(r => setTimeout(r, 3800))]); clearInterval(iv); k = li.length; paint(); await new Promise(r => setTimeout(r, 350));
    $('.tf')?.classList.remove('sending'); if (!I) return;
    if (o.e) { $('#n-from')?.classList.remove('lit'); /PIN|attempt/i.test(o.e.message) ? stepAuth(o.e.message) : /valid|enter|choose|start at|limited to|Choose/i.test(o.e.message) && !/suspend|restrict|frozen/i.test(o.e.message) ? (I.flash = o.e.message, stepDetails()) : fail(o.e.message); } else result(o.r);
  }

  function fail(msg) {
    setStep(5, 'Not sent'); $('#tf-h').innerHTML = 'Something <em>went wrong.</em>'; $('#tf-p').textContent = 'No money left your account.';
    $('#tf-b').innerHTML = `<div class="center"><svg class="big-tick bad" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46"/><path d="M34 34l28 28M62 34L34 62"/></svg><h3 style="font-size:24px;margin:8px 0">Wire not sent</h3><p class="muted" style="line-height:1.55">${esc(msg)}</p></div><button class="tf-cta" id="rt">Try again</button><button class="tf-ghost" id="sp" style="color:var(--g600);font-weight:700">Contact support</button><button class="tf-ghost" id="cl">Close</button>`;
    $('#rt').onclick = stepDetails; $('#cl').onclick = shut; $('#sp').onclick = () => { shut(); customerSupport(); };
  }

  function result(r) {
    const d = I.d, a = acct(), ok = r.status === 'COMPLETED', bad = r.status === 'FAILED', pend = !ok && !bad, c = country();
    setStep(5, bad ? 'Not sent' : 'Received');
    $('#tf-h').innerHTML = bad ? 'It didn’t <em>go through.</em>' : 'We’ve <em>got it.</em>'; $('#tf-p').textContent = bad ? (r.reason || 'Your balance is unchanged.') : `${d.name} should receive ${fc(r.destAmount ?? d.dest, d.cur)} in 1–3 business days. We’ll notify you at each step.`;
    const tick = ok ? '<path d="M28 50l14 14 27-30"/>' : bad ? '<path d="M34 34l28 28M62 34L34 62"/>' : '<path d="M48 26v24l15 9"/>', row = (k, v) => `<div class="r"><span>${k}</span><b>${v}</b></div>`;
    $('#tf-b').innerHTML = `<div class="center"><svg class="big-tick ${bad ? 'bad' : pend ? 'wait' : ''}" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46"/>${tick}</svg><h3 style="font-size:24px;margin:10px 0 0;letter-spacing:-.03em">${ok ? 'Wire sent' : bad ? 'Wire failed' : r.status === 'PENDING' ? 'Wire pending' : 'Wire processing'}</h3><div class="res-amt">${fc(r.destAmount ?? d.dest, d.cur)}</div><span class="muted">to ${esc(d.name)} · ${W.flag(c.code)} ${esc(c.name)}</span></div>
      <div class="tk" style="margin-top:22px">${row('You sent', money(d.value))}${row('Exchange rate', `1 USD = ${ratef(r.fxRate ?? d.rate)} ${d.cur}`)}${row('Bank', esc(d.bank))}${row('SWIFT / BIC', esc(d.bic))}${row('From', esc(a.name))}${row('Wire fee', money(r.fee ?? d.fee))}${row('Total debited', money(r.total ?? d.value + d.fee))}${row('Reference', esc(r.reference))}${row('Status', esc(r.status[0] + r.status.slice(1).toLowerCase()))}</div>
      <button class="tf-cta" id="vr">View receipt</button>${bad ? '<button class="tf-ghost" id="sp" style="color:var(--g600);font-weight:700">Contact support</button>' : ''}<button class="tf-ghost" id="dn">Done</button><button class="tf-ghost" id="an" style="margin-top:0">Send another</button>`;
    api('/api/customer/dashboard').then(x => state.data = x).catch(() => { });
    $('#vr').onclick = () => { shut(); receipt(r.id); }; $('#sp') && ($('#sp').onclick = () => { shut(); customerSupport(); }); $('#dn').onclick = () => { shut(); dashboard(); }; $('#an').onclick = async () => { shut(); await dashboard(); openIntl(); };
  }

  // Dashboard: add a "Send abroad" action next to Send money.
  const baseDash = window.dashboard;
  window.dashboard = async (...a) => { const out = await baseDash(...a); const acts = $('.acts'); if (acts && !$('#abroad')) acts.insertAdjacentHTML('beforeend', '<button id="abroad" onclick="openIntl()">🌐 Send abroad</button>'); return out; };

  /* ---------- 3. Admin: international wire controls ---------- */
  const baseTC = window.adminTransferControl;
  const modal = (title, body) => { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2" style="z-index:350"><div><div class="topline"><h2>${title}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div>${body}</div></div>`); };
  window.adminTransferControl = async (...a) => {
    await baseTC(...a);
    const host = $('#tcf')?.closest('section'); if (!host || $('#intl-admin')) return;
    let cfg; try { cfg = await api('/api/admin/intl-settings'); } catch (e) { return toast(e.message); }
    const [n, u] = cfg.mins > 0 && cfg.mins % 1440 === 0 ? [cfg.mins / 1440, 'd'] : cfg.mins > 0 && cfg.mins % 60 === 0 ? [cfg.mins / 60, 'h'] : [cfg.mins, 'm'];
    const custom = [...cfg.customBanks]; const disabled = new Set(cfg.disabled); const over = { ...cfg.overrides };
    const regions = [...new Set(W.countries.map(c => c.region))], curs = Object.keys(cfg.rates).sort();
    host.insertAdjacentHTML('afterend', `<section class="surface" id="intl-admin" style="margin-top:20px"><div class="surface-head"><div><h2>🌐 International wires</h2><p class="muted">${W.countries.length} countries · ${W.countries.reduce((s, c) => s + c.banks.length, 0)} banks in the directory · rates ${cfg.source === 'live' ? 'are live' : 'are sample values (live feed unreachable)'}. Customers can also be blocked per account under Account details.</p></div></div>
      <form id="ia" class="tc-grid">
        <div class="form-field" style="grid-column:1/-1"><label class="check-row" style="margin:0"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}><span>Allow customers to send international wires</span></label></div>
        <div class="form-field"><label>Wire fee (USD)</label><input name="fee" type="number" min="0" step="0.01" value="${cfg.fee}"></div>
        <div class="form-field"><label>Extra for “OUR” charges (USD)</label><input name="our" type="number" min="0" step="0.01" value="${cfg.our}"></div>
        <div class="form-field"><label>Exchange-rate margin (%)</label><input name="markup" type="number" min="0" max="20" step="0.01" value="${cfg.markup}"></div>
        <div class="form-field"><label>Minimum per wire (USD)</label><input name="min" type="number" min="0" step="1" value="${cfg.min}"></div>
        <div class="form-field"><label>Maximum per wire (USD, 0 = no limit)</label><input name="max" type="number" min="0" step="1" value="${cfg.max}"></div>
        <div class="form-field"><label>International wires settle after</label><div class="dur"><input name="mins_v" type="number" min="0" step="any" value="${n}" required><select name="mins_u"><option value="m" ${u === 'm' ? 'selected' : ''}>minutes</option><option value="h" ${u === 'h' ? 'selected' : ''}>hours</option><option value="d" ${u === 'd' ? 'selected' : ''}>days</option></select></div></div>
        <div class="form-field" style="grid-column:1/-1"><label>Countries customers can send to <small class="muted">(untick to block)</small></label><input id="ia-q" placeholder="Search countries…" style="margin-bottom:10px"><div id="ia-c"></div></div>
        <div class="form-field" style="grid-column:1/-1"><label>Exchange rates <small class="muted">(per 1 USD · leave blank to follow the live rate)</small></label><div class="fx-grid" id="ia-fx">${curs.map(k => `<label><span>${k}</span><input data-cur="${k}" type="number" step="any" min="0" placeholder="${(cfg.mids[k] || 0).toLocaleString('en-US', { maximumSignificantDigits: 6 })}" value="${over[k] || ''}"></label>`).join('')}</div></div>
        <div class="form-field" style="grid-column:1/-1"><label>Custom banks <small class="muted">(added to the customer’s bank list)</small></label><div id="ia-b"></div><div class="ia-add"><select id="ia-bc">${W.countries.map(c => `<option value="${c.code}">${W.flag(c.code)} ${esc(c.name)}</option>`).join('')}</select><input id="ia-bn" placeholder="Bank name" maxlength="60"><select id="ia-bt">${Object.values(W.TYPES).map(t => `<option>${t}</option>`).join('')}</select><input id="ia-bb" placeholder="SWIFT/BIC (optional)" maxlength="11" style="text-transform:uppercase"><button type="button" class="secondary-button" id="ia-ba">Add bank</button></div></div>
        <div style="grid-column:1/-1"><button class="cta" type="submit">Save international settings</button></div></form></section>`);
    const paintC = () => { const q = ($('#ia-q').value || '').toLowerCase(); $('#ia-c').innerHTML = regions.map(r => { const cs = W.countries.filter(c => c.region === r && (c.name.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q))); return cs.length ? `<div class="ia-reg"><div class="ia-rh"><b>${esc(r)}</b><span><button type="button" class="text-button" data-all="${esc(r)}">All</button><button type="button" class="text-button" data-none="${esc(r)}">None</button></span></div><div class="checks3">${cs.map(c => `<label class="check-row" style="margin:0"><input type="checkbox" data-cc="${c.code}" ${disabled.has(c.code) ? '' : 'checked'}><span>${W.flag(c.code)} ${esc(c.name)} <small class="muted">${c.currency}</small></span></label>`).join('')}</div></div>` : ''; }).join(''); $$('[data-cc]').forEach(x => x.onchange = () => x.checked ? disabled.delete(x.dataset.cc) : disabled.add(x.dataset.cc)); $$('[data-all]').forEach(b => b.onclick = () => { W.countries.filter(c => c.region === b.dataset.all).forEach(c => disabled.delete(c.code)); paintC(); }); $$('[data-none]').forEach(b => b.onclick = () => { W.countries.filter(c => c.region === b.dataset.none).forEach(c => disabled.add(c.code)); paintC(); }); };
    const paintB = () => { $('#ia-b').innerHTML = custom.length ? custom.map((b, i) => `<div class="tc-row" style="padding:10px 0"><div><b>${esc(b.name)}</b><small>${W.flag(b.country)} ${esc(W.byCode(b.country)?.name || b.country)} · ${esc(b.type)}${b.bic ? ' · ' + esc(b.bic) : ''}</small></div><button type="button" class="danger-btn" data-rb="${i}">Remove</button></div>`).join('') : '<p class="muted" style="margin:0 0 10px">No custom banks yet.</p>'; $$('[data-rb]').forEach(b => b.onclick = () => { custom.splice(Number(b.dataset.rb), 1); paintB(); }); };
    paintC(); paintB(); $('#ia-q').oninput = paintC;
    $('#ia-ba').onclick = () => { const name = $('#ia-bn').value.trim(), bic = $('#ia-bb').value.trim().toUpperCase(); if (!name) return toast('Enter the bank name.'); if (bic && !W.bicOk(bic)) return toast('That SWIFT/BIC isn’t valid.'); custom.push({ country: $('#ia-bc').value, name, type: $('#ia-bt').value, bic }); $('#ia-bn').value = $('#ia-bb').value = ''; paintB(); };
    $('#ia').onsubmit = async e => { e.preventDefault(); const f = e.target.elements; const overrides = {}; $$('[data-cur]').forEach(x => { if (Number(x.value) > 0) overrides[x.dataset.cur] = Number(x.value); }); const mult = { m: 1, h: 60, d: 1440 }[f.mins_u.value] || 1; try { await post('/api/admin/intl-settings', { enabled: f.enabled.checked, fee: Number(f.fee.value), our: Number(f.our.value), markup: Number(f.markup.value), min: Number(f.min.value || 0), max: Number(f.max.value || 0), mins: Math.round(Number(f.mins_v.value) * mult), disabled: [...disabled], overrides, customBanks: custom }, 'PUT'); toast('International settings saved.'); } catch (err) { toast(err.message); } };
  };
}, 0);
