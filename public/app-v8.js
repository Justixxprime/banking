// v8: Account details page, Support desk (customer + admin), admin card freeze.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const post = (u, b, m = 'POST') => api(u, { method: m, body: JSON.stringify(b) });
  const modal = (title, body) => { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-v2" style="z-index:350"><div><div class="topline"><h2>${title}</h2><button class="close" type="button" onclick="closeModal()">Close</button></div>${body}</div></div>`); };
  const when = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const copy = t => { navigator.clipboard?.writeText(t); toast('Copied.'); };
  window.__copy = copy;

  /* ---------------- ACCOUNT DETAILS ---------------- */
  window.customerDetails = async () => {
    try {
      state.data = await api('/api/customer/dashboard');
      const rt = window.MH_ROUTING, shown = {};
      const draw = () => {
        app.innerHTML = window.__shell('details', `<header class="dash-head"><div><span class="kicker muted-kicker">Your accounts</span><h1>Account details</h1></div><button class="secondary-button" onclick="window.print()">Print</button></header><div class="det">${state.data.accounts.map(a => {
          const held = Number(a.held || 0), avail = Number(a.available_balance) - held, num = String(a.account_number);
          const row = (k, v, cp) => `<div class="drow"><span>${k}</span><div class="v"><b>${v}</b>${cp ? `<button class="cp" onclick="__copy('${esc(cp)}')">Copy</button>` : ''}</div></div>`;
          return `<article class="detcard"><div class="top"><div><small>${esc(a.account_type)}</small><h3>${esc(a.name)}</h3></div><div style="text-align:right"><small>Available balance</small><div class="b">${money(avail)}</div></div></div>
            ${row('Bank', 'Mountain Hills County Credit Union')}${row('Routing number', rt, rt)}
            <div class="drow"><span>Account number</span><div class="v"><b>${shown[a.id] ? esc(num) : '\u2022\u2022\u2022\u2022\u2022\u2022 ' + esc(num.slice(-4))}</b><button class="cp" data-sh="${a.id}">${shown[a.id] ? 'Hide' : 'Show'}</button><button class="cp" onclick="__copy('${esc(num)}')">Copy</button></div></div>
            ${row('Current balance', money(a.balance))}${row('Pending holds', money(held))}${row('Available balance', money(avail))}${row('Account type', esc(a.account_type[0] + a.account_type.slice(1).toLowerCase()))}${row('Status', esc(a.status || 'ACTIVE'))}${row('Interest rate', (a.apy != null ? Number(a.apy).toFixed(2) : a.account_type === 'SAVINGS' ? '4.35' : '0.01') + '% APY')}${row('Member since', state.data.memberSince ? new Date(state.data.memberSince).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '\u2014')}${row('Opened', new Date(a.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</article>`;
        }).join('')}</div><p class="muted" style="font-size:13px;margin-top:18px">Mountain Hills County Credit Union Move forward with more control. Progress leads to possibilities.</p>`);
        $$('[data-sh]').forEach(b => b.onclick = () => { shown[b.dataset.sh] = !shown[b.dataset.sh]; draw(); });
      };
      draw();
    } catch (e) { toast(e.message); }
  };

  /* ---------------- SUPPORT (customer) ---------------- */
  const thread = ms => ms.map(m => `<div class="msg ${m.sender === 'CUSTOMER' ? 'me' : 'them'}">${esc(m.body)}<small>${m.sender === 'CUSTOMER' ? 'You' : 'Mountain Hills Support'} \u00b7 ${when(m.created_at)}</small></div>`).join('');
  window.customerSupport = async (openId) => {
    try {
      const { tickets } = await api('/api/customer/support');
      app.innerHTML = window.__shell('support', `<header class="dash-head"><div><span class="kicker muted-kicker">We\u2019re here to help</span><h1>Support</h1></div><button class="cta" id="nt">+ New message</button></header>
        <div class="contact"><div><small>Call us</small><b>1-202-202-4033</b><div class="muted" style="font-size:13px;margin-top:4px">Fictional number</div></div><div><small>Hours</small><b>Mon\u2013Fri, 8am\u20138pm ET</b><div class="muted" style="font-size:13px;margin-top:4px">Sat 9am\u20135pm</div></div><div><small>Secure messages</small><b>Replies within 1 business day</b></div></div>
        <div class="sup"><section class="surface"><div class="surface-head"><h2>Conversations</h2></div>${tickets.map(t => `<button class="tk-i ${t.id === openId ? 'on' : ''}" data-id="${t.id}"><b>${esc(t.subject)}</b><small>${esc(t.category)} \u00b7 ${when(t.updated_at)} \u00b7 <span class="badge2 ${t.status === 'CLOSED' ? 'closed' : ''}">${t.status === 'CLOSED' ? 'Closed' : t.last_sender === 'ADMIN' ? 'Replied' : 'Open'}</span></small></button>`).join('') || '<p class="muted">No conversations yet.</p>'}</section><section class="surface" id="pane"><p class="muted">Select a conversation, or start a new one.</p></section></div>`);
      $('#nt').onclick = newTicket; $$('.tk-i').forEach(b => b.onclick = () => openTicket(Number(b.dataset.id)));
      if (openId) openTicket(openId);
    } catch (e) { toast(e.message); }
  };
  const newTicket = () => {
    $('#pane').innerHTML = `<div class="surface-head"><h2>New message</h2></div><form id="nf"><div class="form-field"><label>Topic</label><select name="category">${['General', 'Transfers', 'Cards', 'Bill pay', 'Account access', 'Report a problem'].map(c => `<option>${c}</option>`).join('')}</select></div><div class="form-field"><label>Subject</label><input name="subject" maxlength="100" required></div><div class="form-field"><label>How can we help?</label><textarea name="message" rows="5" maxlength="2000" required style="width:100%;border:1px solid #d5e0db;border-radius:11px;padding:14px;font:16px Manrope"></textarea></div><button class="cta" style="width:100%">Send message</button></form>`;
    $('#nf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { const t = await post('/api/customer/support', f); toast('Message sent. We\u2019ll reply soon.'); customerSupport(t.id); } catch (err) { toast(err.message); } };
  };
  const openTicket = async id => {
    try {
      const { ticket, messages } = await api(`/api/customer/support/${id}`);
      $$('.tk-i').forEach(b => b.classList.toggle('on', Number(b.dataset.id) === id));
      $('#pane').innerHTML = `<div class="surface-head"><div><h2>${esc(ticket.subject)}</h2><span class="muted" style="font-size:13px">${esc(ticket.category)}</span></div><span class="badge2 ${ticket.status === 'CLOSED' ? 'closed' : ''}">${ticket.status === 'CLOSED' ? 'Closed' : 'Open'}</span></div><div class="thread" id="th">${thread(messages)}</div><form id="rf" style="display:flex;gap:10px;margin-top:16px"><input name="message" placeholder="Write a reply" maxlength="2000" required style="flex:1;border:1px solid #d5e0db;border-radius:12px;padding:14px;font:16px Manrope"><button class="cta">Send</button></form>`;
      const th = $('#th'); th.scrollTop = th.scrollHeight;
      $('#rf').onsubmit = async e => { e.preventDefault(); try { await post(`/api/customer/support/${id}/messages`, { message: e.target.message.value }); openTicket(id); } catch (err) { toast(err.message); } };
    } catch (e) { toast(e.message); }
  };

  /* ---------------- SUPPORT (admin) ---------------- */
  window.adminSupport = async (openId) => {
    try {
      const { tickets } = await api('/api/admin/support');
      app.innerHTML = window.__shell('support', `<header class="dash-head"><div><span class="kicker muted-kicker">Customer care</span><h1>Support inbox</h1></div></header><div class="sup"><section class="surface"><div class="surface-head"><h2>${tickets.filter(t => t.status === 'OPEN').length} open</h2></div>${tickets.map(t => `<button class="tk-i ${t.id === openId ? 'on' : ''}" data-id="${t.id}"><b>${esc(t.subject)}</b><small>${esc(t.customer_name)} \u00b7 ${when(t.updated_at)} \u00b7 <span class="badge2 ${t.status === 'CLOSED' ? 'closed' : ''}">${t.status === 'CLOSED' ? 'Closed' : t.last_sender === 'ADMIN' ? 'Replied' : 'Needs reply'}</span></small></button>`).join('') || '<p class="muted">No customer messages yet.</p>'}</section><section class="surface" id="pane"><p class="muted">Select a conversation.</p></section></div>`, true);
      $$('.tk-i').forEach(b => b.onclick = () => openAdminTicket(Number(b.dataset.id)));
      if (openId) openAdminTicket(openId);
    } catch (e) { toast(e.message); }
  };
  const openAdminTicket = async id => {
    try {
      const { ticket, messages } = await api(`/api/admin/support/${id}`);
      $$('.tk-i').forEach(b => b.classList.toggle('on', Number(b.dataset.id) === id));
      const closed = ticket.status === 'CLOSED';
      $('#pane').innerHTML = `<div class="surface-head"><div><h2>${esc(ticket.subject)}</h2><span class="muted" style="font-size:13px">${esc(ticket.customer_name)} \u00b7 ${esc(ticket.customer_email)} \u00b7 ${esc(ticket.category)}</span></div><button class="secondary-button" id="st">${closed ? 'Reopen' : 'Close conversation'}</button></div><div class="thread" id="th">${messages.map(m => `<div class="msg ${m.sender === 'ADMIN' ? 'me' : 'them'}">${esc(m.body)}<small>${m.sender === 'ADMIN' ? 'You' : esc(ticket.customer_name)} \u00b7 ${when(m.created_at)}</small></div>`).join('')}</div><form id="rf" style="display:flex;gap:10px;margin-top:16px"><input name="message" placeholder="Write a reply to the customer" maxlength="2000" required style="flex:1;border:1px solid #d5e0db;border-radius:12px;padding:14px;font:16px Manrope"><button class="cta">Reply</button></form>`;
      const th = $('#th'); th.scrollTop = th.scrollHeight;
      $('#rf').onsubmit = async e => { e.preventDefault(); try { await post(`/api/admin/support/${id}/messages`, { message: e.target.message.value }); adminSupport(id); } catch (err) { toast(err.message); } };
      $('#st').onclick = async () => { try { await post(`/api/admin/support/${id}`, { status: closed ? 'OPEN' : 'CLOSED' }, 'PATCH'); adminSupport(id); } catch (err) { toast(err.message); } };
    } catch (e) { toast(e.message); }
  };

  /* ---------------- ADMIN: freeze / unfreeze card ---------------- */
  window.adminCardFor = async (id, name) => {
    try {
      const c = await api(`/api/admin/customers/${id}/card`);
      modal(`Card \u2013 ${esc(name)}`, `<p class="muted" style="line-height:1.55">${c.admin_frozen ? 'This card is frozen by an administrator. The customer cannot unfreeze it.' : c.frozen ? 'The customer has frozen their own card.' : 'This card is active.'}</p><button class="${c.admin_frozen ? 'cta' : 'danger-btn'} modal-submit" style="width:100%" id="cf">${c.admin_frozen ? 'Unfreeze card' : 'Freeze card'}</button><p class="muted" style="font-size:13px;margin-top:12px">The customer is notified and can message support from their dashboard.</p>`);
      $('#cf').onclick = async () => { try { await post(`/api/admin/customers/${id}/card`, { frozen: !c.admin_frozen }); closeModal(); toast(c.admin_frozen ? 'Card unfrozen.' : 'Card frozen.'); } catch (e) { toast(e.message); } };
    } catch (e) { toast(e.message); }
  };
  const baseC = window.adminCustomers;
  if (baseC) window.adminCustomers = async (...a) => {
    await baseC(...a);
    $$('button[onclick^="editCustomer("]').forEach(btn => { const id = /\((\d+)\)/.exec(btn.getAttribute('onclick'))?.[1]; if (!id || btn.parentElement.querySelector('.adm-card')) return; const row = btn.closest('tr') || btn.closest('article') || btn.parentElement; const name = (row.querySelector('b,strong,td')?.textContent || 'customer').trim().replace(/'/g, ''); btn.parentElement.insertAdjacentHTML('beforeend', `<button class="text-button adm-card" onclick="adminCardFor(${id},'${esc(name)}')">Card</button>`); });
  };

  /* customer Cards page: show admin freeze notice */
  const baseCards = window.customerCards;
  window.customerCards = async (...a) => {
    await baseCards(...a);
    try { const c = await api('/api/customer/card'); if (c.admin_frozen) $('.surface')?.insertAdjacentHTML('afterbegin', '<div class="frozenbar">Your card was frozen by Mountain Hills. You can\u2019t unfreeze it yourself. <a style="text-decoration:underline;cursor:pointer" onclick="customerSupport()">Contact support</a></div>'); } catch (e) { /* ignore */ }
  };
}, 0);
