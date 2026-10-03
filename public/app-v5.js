// v5: database-backed Cards, proper Bill Pay, Goals, admin delete controls.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shell = (k, html) => window.__shell(k, html);
  const modal = (title, body) => { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2"><div><div class="topline"><h2>${title}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div>${body}</div></div>`); };
  const ensure = async () => { if (!state.data) state.data = await api('/api/customer/dashboard'); return state.data; };
  const activeAccts = () => state.data.accounts.filter(a => !a.status || a.status === 'ACTIVE');
  const post = (u, b, m = 'POST') => api(u, { method: m, body: JSON.stringify(b) });
  const md = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  /* ---------------- CARDS (saved to database) ---------------- */
  window.customerCards = async () => {
    try {
      await ensure(); const c = await api('/api/customer/card');
      const a = state.account || state.data.accounts[0], last4 = String(a.account_number).slice(-4), name = state.user.name.toUpperCase();
      const sw = (k, t, s) => `<div class="sw"><div><b>${t}</b><small>${s}</small></div><button class="tg ${c[k] ? 'on' : ''}" data-k="${k}" aria-label="${t}"></button></div>`;
      app.innerHTML = window.__shell('cards', `<header class="dash-head"><div><span class="kicker muted-kicker">Your cards</span><h1>Cards</h1></div></header>
      <section class="surface"><div class="vcard-wrap"><div><div class="vcard ${c.frozen ? 'frozen' : ''}" id="vc"><div class="r"><b style="font-size:20px;letter-spacing:-1px">Mountain Hills</b><span style="font:11px 'DM Mono';letter-spacing:.14em">DEBIT</span></div><div style="width:44px;height:32px;border-radius:7px;background:#d7bb68"></div><div><div class="cn" id="vcn">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}</div><div class="r3" style="margin-top:12px"><span>${esc(name)}</span><span>09/29</span></div></div></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="secondary-button" id="reveal">Show details</button></div></div>
      <div class="cctl">${sw('frozen', 'Freeze card', 'Instantly block all card spending')}${sw('online', 'Online payments', 'Purchases on websites and apps')}${sw('intl', 'International use', 'Spending outside the U.S.')}${sw('contactless', 'Contactless', 'Tap to pay at terminals')}</div></div></section>
      <section class="surface" style="margin-top:20px"><div class="surface-head"><h2>Limits</h2></div><div class="mini-list" style="border:0;margin:0"><div><b>Daily card limit</b><span>$10,000.00</span></div><div><b>Daily ATM withdrawal</b><span>$1,000.00</span></div></div></section>`);
      $$('.tg').forEach(b => b.onclick = async () => { const want = !b.classList.contains('on'); b.classList.toggle('on', want); if (b.dataset.k === 'frozen') $('#vc').classList.toggle('frozen', want); try { await post('/api/customer/card', { key: b.dataset.k, value: want }, 'PATCH'); toast(b.dataset.k === 'frozen' ? (want ? 'Card frozen.' : 'Card unfrozen.') : 'Saved.'); } catch (e) { b.classList.toggle('on', !want); toast(e.message); } });
      let shown = false; $('#reveal').onclick = e => { shown = !shown; $('#vcn').textContent = shown ? `4532 8891 2204 ${last4}` : `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${last4}`; e.target.textContent = shown ? 'Hide details' : 'Show details'; };
    } catch (e) { toast(e.message); }
  };

  /* ---------------- BILL PAY ---------------- */
  const dueText = p => { if (p.last_paid_at && new Date(p.last_paid_at).getMonth() === new Date().getMonth()) return `Paid ${md(p.last_paid_at)}`; if (!p.due_day) return 'No due date'; const now = new Date(), d = new Date(now.getFullYear(), now.getMonth(), p.due_day); if (d < now) d.setMonth(d.getMonth() + 1); return `Due ${md(d)}`; };
  window.customerBills = async () => {
    try {
      await ensure(); const { payees } = await api('/api/customer/payees'); const accts = activeAccts();
      const recent = (state.data.transactions || []).filter(t => /^bill payment/i.test(t.description || '')).slice(0, 6);
      app.innerHTML = shell('bills', `<header class="dash-head"><div><span class="kicker muted-kicker">Bill pay</span><h1>Pay bills</h1></div><button class="cta" id="addp">+ Add payee</button></header>
      <div class="bp-grid"><section class="surface"><div class="surface-head"><h2>Make a payment</h2></div>
        ${payees.length ? `<form id="bp-form" novalidate><div class="form-field"><label>Pay to</label><select name="payee">${payees.map(p => `<option value="${p.id}">${esc(p.name)} \u00b7 ${esc(p.category)}</option>`).join('')}</select></div>
        <div class="form-field"><label>Pay from</label><select name="accountId">${accts.map(a => `<option value="${a.id}" ${a.id === state.account?.id ? 'selected' : ''}>${esc(a.name)} \u00b7 ${money(a.available_balance)}</option>`).join('')}</select></div>
        <div class="form-field"><label>Amount (USD)</label><input name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required></div>
        <div class="form-field"><label>Memo <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="memo" maxlength="80" placeholder="e.g. September bill"></div>
        <button class="cta" style="width:100%;margin-top:6px">Review payment</button></form>` : '<p class="muted">Add a payee to start paying bills.</p>'}</section>
        <section class="surface"><div class="surface-head"><h2>Payees</h2></div><div class="plist">${payees.map(p => `<div class="pr"><span class="lg" style="background:${esc(p.color)}">${esc(p.name[0])}</span><div><b>${esc(p.name)}</b><small>${esc(p.category)} \u00b7 ${esc(dueText(p))}</small></div><button class="text-button danger" data-del="${p.id}">Remove</button></div>`).join('') || '<p class="muted">No payees yet.</p>'}</div></section></div>
      <section class="surface" style="margin-top:20px"><div class="surface-head"><h2>Recent bill payments</h2></div>${recent.map(t => `<div class="txn-v2"><div class="txn-title"><span class="txn-icon">\u2193</span><div><b>${esc(t.recipient_name)}</b><small>${md(t.created_at)} \u00b7 ${esc(t.status)}</small></div></div><div><b>${money(t.amount)}</b></div></div>`).join('') || '<p class="muted">Payments you make here will show up in this list.</p>'}</section>`);
      const form = $('#bp-form');
      if (form) {
        const fill = () => { const p = payees.find(x => x.id === Number(form.payee.value)); if (p && Number(p.typical_amount) > 0) form.amount.value = Number(p.typical_amount).toFixed(2); }; form.payee.onchange = fill; fill();
        form.onsubmit = e => { e.preventDefault(); const p = payees.find(x => x.id === Number(form.payee.value)), a = accts.find(x => x.id === Number(form.accountId.value)), amt = Math.round(Number(form.amount.value) * 100) / 100; if (!(amt > 0)) return toast('Enter an amount to pay.'); if (amt > Number(a.available_balance)) return toast('That is more than the available balance.'); reviewBill(p, a, amt, form.memo.value.trim()); };
      }
      $('#addp').onclick = addPayee;
      $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Remove this payee?')) return; try { await api(`/api/customer/payees/${b.dataset.del}`, { method: 'DELETE' }); customerBills(); } catch (e) { toast(e.message); } });
    } catch (e) { toast(e.message); }
  };
  const reviewBill = (p, a, amt, memo) => {
    const row = (k, v, c = '') => `<div class="review-row ${c}"><span>${k}</span><b>${v}</b></div>`;
    modal('Review payment', `<div class="review-hero"><small>You are paying</small><h3>${money(amt)}</h3></div><div class="review-card">${row('To', esc(p.name))}${row('Account no.', esc(p.reference))}${row('From', esc(a.name))}${memo ? row('Memo', esc(memo)) : ''}${row('Delivery', 'Today')}${row('Total', money(amt), 'total')}</div><div class="xfer-actions"><button class="secondary-button" onclick="closeModal()">Cancel</button><button class="cta" id="bp-ok">Pay ${money(amt)}</button></div>`);
    $('#bp-ok').onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Paying\u2026';
      try {
        const r = await post('/api/customer/transfers', { accountId: a.id, recipientName: p.name, recipientAccount: p.reference, recipientBank: p.name + ' (Biller)', amount: amt, description: 'Bill payment \u2013 ' + (memo || p.category) });
        await post(`/api/customer/payees/${p.id}/paid`, {});
        state.data = await api('/api/customer/dashboard');
        modal('Payment sent', `<div class="result"><svg class="tick ok" viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M25 43l12 12 23-25"/></svg><h3>${esc(p.name)} paid</h3><p>${money(amt)} left ${esc(a.name)}. Reference ${esc(r.reference)}.</p></div><div class="xfer-actions"><button class="secondary-button" onclick="closeModal();customerBills()">Done</button><button class="cta" onclick="closeModal();receipt(${r.id})">View receipt</button></div>`);
      } catch (err) { closeModal(); toast(err.message); }
    };
  };
  const addPayee = () => {
    modal('Add payee', `<form id="ap"><div class="form-field"><label>Company or person</label><input name="name" maxlength="60" required></div><div class="form-field"><label>Type</label><select name="category">${['Electric', 'Gas', 'Water', 'Mobile', 'Internet', 'Insurance', 'Rent', 'Loan', 'Credit card', 'Other'].map(c => `<option>${c}</option>`).join('')}</select></div><div class="form-field"><label>Account number on your bill</label><input name="reference" maxlength="40" required></div><div class="form-field"><label>Usual amount <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="typicalAmount" type="number" step="0.01" min="0"></div><button class="cta modal-submit" style="width:100%">Save payee</button></form>`);
    $('#ap').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await post('/api/customer/payees', { ...f, typicalAmount: Number(f.typicalAmount || 0) }); closeModal(); toast('Payee added.'); customerBills(); } catch (err) { toast(err.message); } };
  };

  /* ---------------- GOALS ---------------- */
  window.customerGoals = async () => {
    try {
      await ensure(); const { goals } = await api('/api/customer/goals');
      app.innerHTML = shell('goals', `<header class="dash-head"><div><span class="kicker muted-kicker">Savings goals</span><h1>Goals</h1></div><button class="cta" id="ng">+ New goal</button></header><div class="goals">${goals.map(g => { const pct = Math.min(100, Math.round(g.saved / g.target * 100)); return `<article class="goal"><div style="display:flex;justify-content:space-between;gap:10px"><h3 style="margin:0">${esc(g.name)}</h3><button class="text-button danger" data-gd="${g.id}">Delete</button></div><div class="bar"><i style="width:${pct}%"></i></div><div class="gm"><span>${money(g.saved)} of ${money(g.target)}</span><b style="color:var(--ink)">${pct}%</b></div><div style="display:flex;gap:8px;margin-top:16px"><button class="secondary-button" data-ga="${g.id}" style="flex:1;padding:11px">Add money</button><button class="secondary-button" data-gw="${g.id}" style="flex:1;padding:11px">Take out</button></div></article>`; }).join('') || '<section class="surface"><p class="muted">No goals yet. Start one for a trip, a car, or a rainy day.</p></section>'}</div>`);
      $('#ng').onclick = () => { modal('New goal', `<form id="gf"><div class="form-field"><label>What are you saving for?</label><input name="name" maxlength="60" required></div><div class="form-field"><label>Target amount (USD)</label><input name="target" type="number" step="0.01" min="1" required></div><div class="form-field"><label>Already saved <small style="font-weight:400;color:var(--soft)">(optional)</small></label><input name="saved" type="number" step="0.01" min="0"></div><button class="cta modal-submit" style="width:100%">Create goal</button></form>`); $('#gf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await post('/api/customer/goals', { name: f.name, target: Number(f.target), saved: Number(f.saved || 0) }); closeModal(); customerGoals(); } catch (err) { toast(err.message); } }; };
      const amountModal = (id, sign) => { modal(sign > 0 ? 'Add money' : 'Take money out', `<form id="gm"><div class="form-field"><label>Amount (USD)</label><input name="a" type="number" step="0.01" min="0.01" required></div><button class="cta modal-submit" style="width:100%">Confirm</button></form>`); $('#gm').onsubmit = async e => { e.preventDefault(); try { await post(`/api/customer/goals/${id}`, { add: sign * Number(e.target.a.value) }, 'PATCH'); closeModal(); customerGoals(); } catch (err) { toast(err.message); } }; };
      $$('[data-ga]').forEach(b => b.onclick = () => amountModal(b.dataset.ga, 1)); $$('[data-gw]').forEach(b => b.onclick = () => amountModal(b.dataset.gw, -1));
      $$('[data-gd]').forEach(b => b.onclick = async () => { if (!confirm('Delete this goal?')) return; try { await api(`/api/customer/goals/${b.dataset.gd}`, { method: 'DELETE' }); customerGoals(); } catch (e) { toast(e.message); } });
    } catch (e) { toast(e.message); }
  };

  /* ---------------- ADMIN: delete customers / accounts ---------------- */
  const confirmDelete = (kind, id, label) => modal(`Delete ${kind}?`, `<p class="muted" style="line-height:1.55">This permanently deletes <b>${esc(label)}</b>${kind === 'customer' ? ', all of their accounts, transactions and notifications' : ' and every transaction on it'}. This cannot be undone.</p><div style="display:flex;gap:10px;margin-top:18px"><button class="danger-btn" style="flex:1" id="cd-ok">Delete ${kind}</button><button class="secondary-button" onclick="closeModal()">Keep</button></div>`) || ($('#cd-ok').onclick = async () => { try { await api(`/api/admin/${kind === 'customer' ? 'customers' : 'accounts'}/${id}`, { method: 'DELETE' }); closeModal(); toast(`${kind[0].toUpperCase() + kind.slice(1)} deleted.`); (kind === 'customer' ? adminCustomers : adminAccounts)(); } catch (e) { toast(e.message); } });
  const addDeletes = (fn, sel, kind) => { const base = window[fn]; window[fn] = async (...a) => { await base(...a); $$(sel).forEach(btn => { const id = /\((\d+)\)/.exec(btn.getAttribute('onclick'))?.[1]; if (!id || btn.parentElement.querySelector('.adm-del')) return; const row = btn.closest('tr') || btn.closest('article') || btn.parentElement; const label = (row.querySelector('b,strong,td')?.textContent || kind + ' ' + id).trim(); btn.parentElement.insertAdjacentHTML('beforeend', `<button class="text-button danger adm-del" data-id="${id}">Delete</button>`); btn.parentElement.querySelector('.adm-del:last-child').onclick = () => confirmDelete(kind, id, label); }); }; };
  addDeletes('adminCustomers', 'button[onclick^="editCustomer("]', 'customer');
  addDeletes('adminAccounts', 'button[onclick^="editAccount("]', 'account');
}, 0);
