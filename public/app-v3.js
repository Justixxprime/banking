// Mountain Hills v3: guided transfer flow, bank-style receipts, admin receipt deletion.
// Loaded after app-v2.js; its setTimeout(0) runs after v2's, so these overrides win.
setTimeout(() => {
  const esc = escapeText;
  const banks = ['Mountain Hills', 'Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'U.S. Bank', 'Capital One', 'PNC Bank', 'TD Bank', 'Truist', 'Goldman Sachs', 'HSBC', 'Barclays', 'Access Bank', 'GTBank', 'Zenith Bank', 'First Bank of Nigeria', 'UBA'];
  const mask = n => `\u2022\u2022\u2022\u2022 ${String(n || '').slice(-4)}`;
  const fullStamp = v => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(v)).replace(',', '').replace(/(\d{4})/, '$1 \u00b7');
  const hashNum = (text, digits) => { let h = 7; for (const c of String(text)) h = (h * 131 + c.charCodeAt(0)) % 9999999967; return String(h).padStart(digits, '0').slice(-digits); };
  const parseAmount = v => Number(String(v).replace(/[^0-9.]/g, ''));
  const modalBox = (title, body, cls = '') => { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2 ${cls}"><div><div class="topline"><h2>${title}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div>${body}</div></div>`); };

  /* ===================== RECEIPT ===================== */
  const barcode = ref => {
    let seed = 0; for (const c of String(ref)) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    let x = 0, bars = '';
    for (let i = 0; i < 70; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const w = 1 + ((seed >>> 28) % 3), gap = 1 + ((seed >>> 26) % 2); bars += `<rect x="${x}" y="0" width="${w}" height="44"/>`; x += w + gap; }
    return `<svg viewBox="0 0 ${x} 44" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
  };
  const receiptHTML = (t, senderName) => {
    const st = String(t.status).toLowerCase();
    const label = t.status_label || ({ completed: 'Successful', pending: 'Pending', processing: 'Processing', failed: 'Failed' }[st] || t.status);
    const icon = { completed: '\u2713', pending: '\u25cf', processing: '\u25cf', failed: '\u2715' }[st] || '';
    const line = (k, v, cls = '') => `<div class="rcpt-line ${cls}"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="rcpt-wrap"><article class="rcpt" id="receipt-print">
      <div class="rcpt-top"><div class="wordmark">Mountain Hills</div><small>Transaction receipt</small></div>
      <div class="rcpt-amount"><span class="stamp ${st}">${icon} ${label}</span><h2>${money(t.amount)}</h2><p>${st === 'failed' ? 'Transfer was not completed' : 'Outward transfer to ' + esc(t.recipient_name)}</p>${t.status_message ? `<div class="rcpt-note">${esc(t.status_message)}</div>` : ''}</div>
      <div class="rcpt-sec"><h4>Transaction</h4>
        ${line('Date &amp; time', esc(fullStamp(t.created_at)))}
        ${line('Reference', esc(t.reference), 'mono')}
        ${line('Confirmation no.', hashNum(t.reference + t.id, 12), 'mono')}
        ${line('Type', 'Outward transfer')}
        ${t.delivery_method ? line('Delivery', esc(({ instant: 'Instant \u00b7 within seconds', same: 'Same-day ACH \u00b7 by end of day', ach: 'Standard ACH \u00b7 1\u20133 business days' })[t.delivery_method] || '')) : ''}
        ${line('Channel', 'Mountain Hills Online')}
        ${t.description ? line('Narration', esc(t.description)) : ''}
      </div>
      <div class="rcpt-sec"><h4>From</h4>
        ${line('Account holder', esc(senderName || ''))}
        ${line('Account', esc(t.sender_account || 'Mountain Hills account'))}
        ${line('Account no.', esc(mask(t.account_number)), 'mono')}
      </div>
      <div class="rcpt-sec"><h4>To</h4>
        ${line('Beneficiary', esc(t.recipient_name))}
        ${line('Account no.', esc(t.recipient_account), 'mono')}
        ${line('Bank', esc(t.recipient_bank))}
      </div>
      <div class="rcpt-sec"><h4>Summary</h4>
        ${line('Amount', money(t.amount))}
        ${line('Transfer fee', money(0))}
        ${line('Total debited', st === 'failed' ? money(0) : money(t.amount), 'big')}
      </div>
      <div class="rcpt-sec"><h4>Progress</h4><ol class="tl">${(() => { const st2 = String(t.status); const done = st2 === 'COMPLETED', proc = st2 === 'PROCESSING' || done, bad2 = st2 === 'FAILED'; return `<li class="on"><b>Submitted</b><small>${esc(fullStamp(t.created_at))}</small></li><li class="${proc ? 'on' : ''}"><b>Processing</b><small>${proc ? 'Sent to the receiving bank' : 'Waiting to be processed'}</small></li><li class="${done ? 'on' : bad2 ? 'bad' : ''}"><b>${bad2 ? 'Failed' : 'Completed'}</b><small>${done ? 'Funds delivered' : bad2 ? esc(t.failure_reason || 'Not completed. No money was sent.') : 'Not yet completed'}</small></li>`; })()}</ol></div>
      <div class="rcpt-bar">${barcode(t.reference)}<small>${esc(t.reference)}</small></div>
      <div class="rcpt-foot">This is an electronically generated receipt and does not require a signature.<br>Mountain Hills \u00b7 Banking built with clarity, care, and craft.<br>Keep this receipt for your records.</div>
    </article><div class="rcpt-zig"></div></div>`;
  };
  const shareReceipt = async (ref, amount) => {
    const text = `Mountain Hills transfer ${ref} \u2013 ${amount}`;
    try { if (navigator.share) await navigator.share({ title: 'Mountain Hills receipt', text }); else { await navigator.clipboard.writeText(text); toast('Receipt reference copied.'); } } catch (e) { /* cancelled */ }
  };
  window.shareReceipt = shareReceipt;

  // Customer receipt page (replaces v2's plain one)
  window.receipt = async id => {
    try {
      const { transaction: t, customer } = await api(`/api/customer/transactions/${id}/receipt`);
      app.innerHTML = `<main class="site rcpt-page page-enter"><div class="topline"><div class="wordmark">Mountain Hills</div><button class="ghost" onclick="dashboard()">\u2190 Back</button></div>${receiptHTML(t, customer?.name)}<div class="rcpt-wrap"><div class="rcpt-actions"><button class="cta" onclick="window.print()">Save / Print PDF</button><button class="secondary-button" onclick="shareReceipt('${esc(t.reference)}','${money(t.amount)}')">Share</button>${t.status === 'FAILED' || t.status_message ? '<button class="cta" onclick="customerSupport()">Contact support</button>' : ''}<button class="secondary-button" onclick="transactions()">All activity</button></div></div></main>`;
      window.scrollTo(0, 0);
    } catch (error) { toast(error.message); }
  };

  /* ===================== ADMIN: receipt + delete ===================== */
  window.viewAdminReceipt = async id => {
    try {
      const { transaction: t, customer } = await api(`/api/admin/transactions/${id}/receipt`);
      modalBox('Receipt', `<div class="rcpt-modal">${receiptHTML(t, customer.name)}<div class="rcpt-wrap"><div class="rcpt-actions"><button class="cta" onclick="window.print()">Print</button><button class="secondary-button" onclick="adminSetStatus(${t.id})">Status</button><button class="secondary-button" onclick="editTransaction(${t.id})">Edit</button><button class="danger-btn" onclick="deleteTransactionPrompt(${t.id})">Delete</button></div></div></div>`);
    } catch (error) { toast(error.message); }
  };
  window.deleteTransactionPrompt = async id => {
    try {
      const { transaction: t } = await api(`/api/admin/transactions/${id}/receipt`);
      const completed = t.status === 'COMPLETED';
      modalBox('Delete receipt?', `<p class="muted" style="line-height:1.55">This permanently removes <b>${esc(t.reference)}</b> (${money(t.amount)} to ${esc(t.recipient_name)}). The customer will no longer see it in their activity or statements. This cannot be undone.</p>${completed ? `<label class="check-row"><input type="checkbox" id="restore-balance"><span>Also give ${money(t.amount)} back to the customer's account balance.</span></label>` : ''}<div class="form-actions wide" style="display:flex;gap:10px"><button class="danger-btn" style="flex:1" onclick="confirmDeleteTransaction(${t.id})">Delete receipt</button><button class="secondary-button" onclick="closeModal()">Keep it</button></div>`);
    } catch (error) { toast(error.message); }
  };
  window.confirmDeleteTransaction = async id => {
    const restore = document.querySelector('#restore-balance')?.checked ? 'true' : 'false';
    try {
      await api(`/api/admin/transactions/${id}?restoreBalance=${restore}`, { method: 'DELETE' });
      closeModal(); toast('Receipt deleted.'); adminTransactions(state.transactionOffset || 0);
    } catch (error) { toast(error.message); }
  };
  // Add a Delete button beside each row's Receipt / Edit buttons
  const baseAdminTransactions = window.adminTransactions;
  window.adminTransactions = async (...args) => {
    await baseAdminTransactions(...args);
    document.querySelectorAll('button[onclick^="viewAdminReceipt("]').forEach(btn => {
      const id = /\((\d+)\)/.exec(btn.getAttribute('onclick'))?.[1];
      if (!id || btn.parentElement.querySelector('.tx-delete')) return;
      btn.parentElement.insertAdjacentHTML('beforeend', `<button class="text-button danger tx-delete" onclick="deleteTransactionPrompt(${id})">Delete</button>`);
    });
  };

  /* ===================== TRANSFER FLOW ===================== */
  let X = null; // flow state
  const close = () => { document.querySelector('.xfer-back')?.remove(); X = null; };
  const shell = (title, step, body, { back = true } = {}) => {
    document.querySelector('.xfer-back')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="xfer-back"><div class="xfer" role="dialog" aria-modal="true"><div class="xfer-head">${back && step > 1 && step < 5 ? '<button class="xfer-icon" type="button" id="xf-back" aria-label="Back">\u2190</button>' : ''}<h2>${title}</h2>${step < 5 || step === 6 ? '<button class="xfer-icon" type="button" id="xf-x" aria-label="Close">\u2715</button>' : ''}</div><div class="xfer-steps">${[1, 2, 3, 4].map(i => `<i class="${i <= Math.min(step, 4) ? 'on' : ''}"></i>`).join('')}</div><div class="xfer-body">${body}</div></div></div>`);
    document.querySelector('#xf-x')?.addEventListener('click', close);
    document.querySelector('#xf-back')?.addEventListener('click', () => go(step - 1));
  };
  const go = step => ({ 1: stepDetails, 2: stepReview, 3: stepAuth }[step] || stepDetails)();
  const acct = () => X.accounts.find(a => a.id === X.d.accountId) || X.accounts[0];

  window.openTransfer = async () => {
    try {
      if (!state.data) state.data = await api('/api/customer/dashboard');
      const accounts = state.data.accounts.filter(a => !a.status || a.status === 'ACTIVE');
      if (!accounts.length) return toast('No account is available for transfers.');
      X = { accounts, d: { accountId: (state.account && accounts.find(a => a.id === state.account.id)?.id) || accounts[0].id, recipientName: '', recipientAccount: '', recipientBank: '', amount: '', description: '' } };
      stepDetails();
    } catch (error) { toast(error.message); }
  };

  function stepDetails() {
    const d = X.d;
    shell('Send money', 1, `<form id="xf-form" novalidate>
      <span class="xfer-label">Pay from</span>
      <div class="xfer-accts">${X.accounts.map(a => `<button type="button" class="xfer-acct ${a.id === d.accountId ? 'on' : ''}" data-id="${a.id}"><span class="dot"></span><div><b>${esc(a.name)}</b><small>${esc(mask(a.account_number))} \u00b7 ${esc(a.account_type)}</small></div><strong>${money(a.available_balance)}</strong></button>`).join('')}</div>
      <div class="form-field"><label class="xfer-label" style="margin-top:8px">Amount</label><div class="amount-box"><span>$</span><input id="xf-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(d.amount)}"></div><div class="xfer-hint" id="xf-avail"></div><div class="xfer-err" id="xf-err"></div></div>
      <div class="form-field"><label>Recipient name</label><input name="recipientName" autocomplete="off" maxlength="80" placeholder="Full name as on their account" value="${esc(d.recipientName)}"></div>
      <div class="form-field"><label>Account number</label><input name="recipientAccount" inputmode="numeric" autocomplete="off" maxlength="40" placeholder="Recipient account number" value="${esc(d.recipientAccount)}"></div>
      <div class="form-field"><label>Recipient bank</label><input name="recipientBank" list="xf-banks" autocomplete="off" maxlength="80" placeholder="Start typing a bank name" value="${esc(d.recipientBank)}"><datalist id="xf-banks">${banks.map(b => `<option value="${b}">`).join('')}</datalist></div>
      <div class="form-field"><label>Narration <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="description" maxlength="140" placeholder="What is this for?" value="${esc(d.description)}"></div>
      <div class="xfer-actions"><button class="cta" type="submit">Continue</button></div></form>`);
    const form = document.querySelector('#xf-form'), amt = document.querySelector('#xf-amount'), err = document.querySelector('#xf-err'), avail = document.querySelector('#xf-avail');
    const showAvail = () => { avail.textContent = `Available: ${money(acct().available_balance)}`; }; showAvail();
    document.querySelectorAll('.xfer-acct').forEach(b => b.addEventListener('click', () => { d.accountId = Number(b.dataset.id); document.querySelectorAll('.xfer-acct').forEach(x => x.classList.toggle('on', x === b)); showAvail(); }));
    amt.addEventListener('input', () => { let v = amt.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); if (p.length > 2) v = p[0] + '.' + p.slice(1).join(''); const [i, f] = v.split('.'); v = (i ? Number(i).toLocaleString('en-US') : '') + (f !== undefined ? '.' + f.slice(0, 2) : ''); amt.value = v; err.textContent = ''; });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)); const value = parseAmount(amt.value);
      Object.assign(d, { recipientName: f.recipientName.trim(), recipientAccount: f.recipientAccount.trim(), recipientBank: f.recipientBank.trim(), description: f.description.trim(), amount: amt.value });
      if (!value || value <= 0) { err.textContent = 'Enter an amount to send.'; return amt.focus(); }
      if (value > Number(acct().available_balance)) { err.textContent = 'This is more than the available balance on the selected account.'; return amt.focus(); }
      if (d.recipientName.length < 2) return toast('Enter the recipient\'s name.');
      if (d.recipientAccount.length < 6) return toast('Enter a valid recipient account number.');
      if (!d.recipientBank) return toast('Choose or type the recipient bank.');
      d.value = Math.round(value * 100) / 100;
      stepReview();
    });
  }

  function stepReview() {
    const d = X.d, a = acct(), row = (k, v, c = '') => `<div class="review-row ${c}"><span>${k}</span><b>${v}</b></div>`;
    shell('Review transfer', 2, `<div class="review-hero"><small>You are sending</small><h3>${money(d.value)}</h3></div>
      <div class="review-card">${row('To', esc(d.recipientName))}${row('Account number', esc(d.recipientAccount))}${row('Bank', esc(d.recipientBank))}${row('From', `${esc(a.name)}<br><span style="font-weight:400">${esc(mask(a.account_number))}</span>`)}${d.description ? row('Narration', esc(d.description)) : ''}${row('Transfer fee', money(0))}${row('Arrival', 'Instant')}${row('Total to be debited', money(d.value), 'total')}</div>
      <div class="review-note">Please confirm the recipient's details. Transfers can't always be reversed once they are sent.</div>
      <div class="xfer-actions"><button class="secondary-button" type="button" id="xf-edit">Edit</button><button class="cta" type="button" id="xf-ok">Confirm &amp; continue</button></div>`);
    document.querySelector('#xf-edit').onclick = stepDetails;
    document.querySelector('#xf-ok').onclick = stepAuth;
  }

  function stepAuth() {
    shell('Authorise', 3, `<div class="lock-badge">\ud83d\udd12</div><div class="otp-note"><b style="color:var(--ink);font-size:17px">Enter your security code</b><br>We sent a 6-digit code to your registered device to approve this ${money(X.d.value)} transfer.</div>
      <div class="otp" id="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1}">`).join('')}</div>
      <div class="xfer-err" id="otp-err" style="text-align:center"></div>
      <div class="xfer-actions"><button class="cta" type="button" id="xf-send" disabled>Send ${money(X.d.value)}</button></div>
      <p class="otp-note" style="margin-top:14px;font-size:13px">Didn't get it? <button type="button" class="text-button" id="xf-resend" style="font-size:13px">Resend code</button></p>`);
    const boxes = [...document.querySelectorAll('#otp input')], btn = document.querySelector('#xf-send');
    const sync = () => { btn.disabled = boxes.some(b => !b.value); };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); sync(); });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); if (e.key === 'Enter' && !btn.disabled) btn.click(); });
      b.addEventListener('paste', e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); t.split('').forEach((c, k) => { if (boxes[k]) boxes[k].value = c; }); boxes[Math.min(t.length, 5)].focus(); sync(); });
    });
    boxes[0].focus();
    document.querySelector('#xf-resend').onclick = () => toast('A new code has been sent.');
    btn.onclick = submitTransfer;
  }

  async function submitTransfer() {
    const d = X.d, steps = ['Verifying your details', 'Checking your balance', 'Sending to ' + d.recipientBank, 'Confirming with the bank'];
    shell('Processing', 4, `<div class="proc"><div class="spinner"></div><h3>Sending your money</h3><p class="muted">Please don't close this window.</p><ul class="proc-list">${steps.map((s, i) => `<li data-i="${i}">${esc(s)}</li>`).join('')}</ul></div>`, { back: false });
    const lis = [...document.querySelectorAll('.proc-list li')];
    let tick = 0; const advance = () => { lis.forEach((li, i) => { li.classList.toggle('done', i < tick); li.classList.toggle('on', i === tick); }); };
    advance(); const timer = setInterval(() => { if (tick < lis.length) { tick++; advance(); } }, 700);
    const call = api('/api/customer/transfers', { method: 'POST', body: JSON.stringify({ accountId: d.accountId, recipientName: d.recipientName, recipientAccount: d.recipientAccount, recipientBank: d.recipientBank, amount: d.value, description: d.description }) }).then(r => ({ r }), e => ({ e }));
    const [out] = await Promise.all([call, new Promise(r => setTimeout(r, 3000))]);
    clearInterval(timer);
    if (out.e) return stepError(out.e.message);
    stepResult(out.r);
  }

  function stepError(message) {
    shell('Transfer not sent', 5, `<div class="result"><svg class="tick bad" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M28 28l28 28M56 28L28 56"/></svg><h3>Something went wrong</h3><p>${esc(message)}</p></div><div class="xfer-actions"><button class="secondary-button" id="xf-c">Close</button><button class="cta" id="xf-retry">Try again</button></div>`, { back: false });
    document.querySelector('#xf-c').onclick = close; document.querySelector('#xf-retry').onclick = stepDetails;
  }

  async function stepResult(r) {
    const d = X.d, a = acct(), ok = r.status === 'COMPLETED', bad = r.status === 'FAILED';
    const title = ok ? 'Transfer successful' : bad ? 'Transfer failed' : r.status === 'PENDING' ? 'Transfer pending' : 'Transfer processing';
    const sub = ok ? `${money(d.value)} is on its way to ${esc(d.recipientName)}.` : bad ? 'Your money was not sent and your balance is unchanged.' : 'Your transfer has been received and will complete shortly.';
    const svg = ok ? '<svg class="tick ok" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M25 43l12 12 23-25"/></svg>' : bad ? '<svg class="tick bad" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M28 28l28 28M56 28L28 56"/></svg>' : '<svg class="tick wait" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M42 24v20l13 8"/></svg>';
    const row = (k, v) => `<div class="review-row"><span>${k}</span><b>${v}</b></div>`;
    shell('Transfer', 6, `<div class="result">${svg}<h3>${title}</h3><p>${sub}</p><div class="big">${money(d.value)}</div><div class="review-card">${row('To', esc(d.recipientName))}${row('Bank', esc(d.recipientBank))}${row('From', esc(a.name))}${row('Reference', esc(r.reference))}${row('Status', esc(r.status))}</div></div>
      <div class="xfer-actions" style="flex-wrap:wrap"><button class="secondary-button" id="xf-done">Done</button><button class="cta" id="xf-rcpt">View receipt</button></div>
      <div style="text-align:center;margin-top:14px"><button class="text-button" id="xf-again">Make another transfer</button></div>`, { back: false });
    api('/api/customer/dashboard').then(x => { state.data = x; }).catch(() => {});
    document.querySelector('#xf-done').onclick = () => { close(); dashboard(); };
    document.querySelector('#xf-rcpt').onclick = () => { close(); receipt(r.id); };
    document.querySelector('#xf-again').onclick = async () => { close(); await dashboard(); openTransfer(); };
  }
}, 0);
