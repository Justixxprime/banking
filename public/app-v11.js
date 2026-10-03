// v11: admin pages show what you changed (badges + auto-refresh); customer dashboard analytics + live transfer tracker.
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const dshort = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const list = r => Array.isArray(r) ? r : (r.accounts || r.customers || r.users || []);

  /* ---------- admin: refresh whatever page is open ---------- */
  window.refreshAdmin = () => {
    if ($('#tcf')) return adminTransferControl();
    if ($('button[onclick^="editAccount("]')) return adminAccounts();
    if ($('button[onclick^="editCustomer("]')) return adminCustomers();
    if ($('button[onclick^="viewAdminReceipt("]')) return adminTransactions(state.transactionOffset || 0);
  };
  // patch saves in v9 to refresh afterwards
  const origToast = window.toast;
  window.toast = (m, ...a) => { origToast(m, ...a); if (/^(Account saved|Transfer status|Status updated|Join date saved|Card (frozen|unfrozen)|Transfer settings saved|Account details saved)/.test(m)) setTimeout(() => window.refreshAdmin(), 250); };

  const rowOf = btn => btn.closest('tr') || btn.closest('article') || btn.parentElement;
  const slot = row => { let b = row.querySelector('.admin-badges'); if (!b) { const host = row.querySelector('td') || row; b = document.createElement('div'); b.className = 'admin-badges'; host.appendChild(b); } return b; };
  const RL = window.RL || {};
  const baseAcc = window.adminAccounts;
  if (baseAcc) window.adminAccounts = async (...a) => {
    await baseAcc(...a);
    try {
      const accs = list(await api('/api/admin/accounts'));
      $$('button[onclick^="editAccount("]').forEach(btn => {
        const id = Number(/\((\d+)\)/.exec(btn.getAttribute('onclick'))?.[1]); const x = accs.find(r => Number(r.id) === id); if (!x) return;
        const b = slot(rowOf(btn)); const tags = [];
        if (x.status && x.status !== 'ACTIVE') tags.push('<i class="warn">Suspended</i>');
        if (x.restriction && x.restriction !== 'NONE') tags.push(`<i class="warn">${esc(RL[x.restriction] || x.restriction)}</i>`);
        if (Number(x.manual_hold) > 0) tags.push(`<i class="amber">Hold ${money(x.manual_hold)}</i>`);
        if (x.apy != null) tags.push(`<i>APY ${Number(x.apy).toFixed(2)}%</i>`);
        if (x.created_at) tags.push(`<i>Opened ${dshort(x.created_at)}</i>`);
        const bm = String(x.blocked_methods || '').split(',').filter(Boolean); if (bm.length) tags.push(`<i class="warn">Blocked: ${bm.map(m => ({ instant: 'Instant', same: 'Same-day', ach: 'Standard', wire: 'Wire' }[m] || m)).join(', ')}</i>`);
        if (x.transfers_enabled === false) tags.push('<i class="warn">Transfers off</i>');
        b.innerHTML = tags.join('') || '<i>No restrictions</i>';
      });
    } catch (e) { /* badges are optional */ }
  };
  const baseCus = window.adminCustomers;
  if (baseCus) window.adminCustomers = async (...a) => {
    await baseCus(...a);
    try {
      const cs = list(await api('/api/admin/customers'));
      $$('button[onclick^="editCustomer("]').forEach(btn => {
        const id = Number(/\((\d+)\)/.exec(btn.getAttribute('onclick'))?.[1]); const x = cs.find(r => Number(r.id) === id); if (!x) return;
        const b = slot(rowOf(btn)); const tags = [];
        if (x.created_at) tags.push(`<i>Member since ${dshort(x.created_at)}</i>`);
        if (x.status && x.status !== 'ACTIVE') tags.push('<i class="warn">Suspended</i>');
        if (x.transfer_pin_updated_at) tags.push(`<i>PIN set ${dshort(x.transfer_pin_updated_at)}</i>`); else tags.push('<i class="amber">Default PIN 123456</i>');
        if (x.pin_locked_until && new Date(x.pin_locked_until) > new Date()) tags.push('<i class="warn">PIN locked</i>');
        b.innerHTML = tags.join('');
      });
    } catch (e) { /* optional */ }
  };

  /* ---------- customer: analytics + transfer tracker ---------- */
  const MS = { instant: 'Instant', same: 'Same-day ACH', ach: 'Standard ACH', wire: 'Wire transfer' };
  const bars = (daily, days) => {
    const map = new Map(daily.map(d => [String(d.d).slice(0, 10), d])); const out = [];
    for (let i = days - 1; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); const k = dt.toLocaleDateString('en-CA'); out.push({ k, dt, v: Number(map.get(k)?.out || 0), n: map.get(k)?.n || 0 }); }
    const mx = Math.max(...out.map(o => o.v), 1), total = out.reduce((s, o) => s + o.v, 0);
    return `<div class="cf-sum"><div><small>Total out</small><b>${money(total)}</b></div><div><small>Average / day</small><b>${money(total / days)}</b></div><div><small>Busiest day</small><b>${money(mx === 1 && !total ? 0 : mx)}</b></div></div><div class="cf" style="--n:${out.length}">${out.map((o, i) => `<div class="cf-b" style="height:${Math.max(3, o.v / mx * 100)}%;animation-delay:${i * 18}ms" data-t="${esc(o.dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} \u00b7 ${money(o.v)}${o.n ? ' \u00b7 ' + o.n + ' transfer' + (o.n > 1 ? 's' : '') : ''}"></div>`).join('')}</div><div class="cf-ax"><span>${out[0].dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>${out[Math.floor(out.length / 2)].dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>Today</span></div>`;
  };
  const tracker = txs => {
    const live = txs.filter(t => ['PENDING', 'PROCESSING'].includes(t.status)); if (!live.length) return '';
    return `<article class="card2 trk"><div class="hd"><h2>Transfers in progress</h2><span class="livepill"><i></i>Live</span></div>${live.map(t => {
      const s = new Date(t.created_at).getTime(), e = t.settles_at ? new Date(t.settles_at).getTime() : null, now = Date.now();
      const pct = e ? Math.max(8, Math.min(95, (now - s) / (e - s) * 100)) : 30;
      const step = t.status === 'PROCESSING' ? 2 : 1;
      return `<div class="trk-i"><div class="trk-h"><b>${money(t.amount)} to ${esc(t.recipient_name)}</b><span>${esc(t.status_label || (t.status[0] + t.status.slice(1).toLowerCase()))}</span></div><div class="trk-bar"><i style="width:${pct}%"></i></div><div class="trk-s"><span class="on">Submitted</span><span class="${step >= 2 ? 'on' : ''}">Processing</span><span>Completed</span></div><small>${esc(MS[t.delivery_method] || 'Transfer')} \u00b7 ${esc(t.reference)}${t.status_message ? ' \u00b7 ' + esc(t.status_message) : ''}</small></div>`;
    }).join('')}</article>`;
  };
  const baseDash = window.dashboard || dashboard;
  dashboard = async (...a) => {
    await baseDash(...a);
    const host = $('.dv'); if (!host || !state.data || $('.cf-card')) return;
    const anchor = $('.tiles'); if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', `${tracker(state.data.transactions)}<article class="card2 cf-card"><div class="hd"><h2>Cash flow</h2><div class="mk-tabs" id="cf-tabs" style="margin:0">${[7, 30, 90].map(n => `<button data-n="${n}" class="${n === 30 ? 'on' : ''}">${n}D</button>`).join('')}</div></div><div id="cf-body"><p class="muted">Loading\u2026</p></div></article>`);
    const load = async n => { try { const r = await api(`/api/customer/analytics?days=${n}`); const b = $('#cf-body'); if (b) b.innerHTML = bars(r.daily, n) + (r.top.length ? `<div class="top5"><h3>Top recipients</h3>${r.top.map((t, i) => `<div class="t5"><span class="av" style="background:${['#cde8a4', '#9fd8cc', '#f1d38a', '#f4b3a3', '#b7cdf5'][i % 5]}">${esc(t.recipient_name[0])}</span><b>${esc(t.recipient_name)}</b><span class="muted">${t.n} transfer${t.n > 1 ? 's' : ''}</span><strong>${money(t.total)}</strong></div>`).join('')}</div>` : ''); } catch (e) { const b = $('#cf-body'); if (b) b.innerHTML = '<p class="muted">Cash flow is unavailable right now.</p>'; } };
    $$('#cf-tabs button').forEach(b => b.onclick = () => { $$('#cf-tabs button').forEach(x => x.classList.toggle('on', x === b)); load(Number(b.dataset.n)); });
    load(30);
  };
}, 0);
