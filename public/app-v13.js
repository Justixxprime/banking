// v13: Activity page (search, filters, grouped by day, export).
setTimeout(() => {
  const esc = escapeText, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const AV = ['#cde8a4', '#9fd8cc', '#f1d38a', '#f4b3a3', '#b7cdf5', '#d9c2f0'];
  const avc = n => AV[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  const MLAB = { instant: 'Instant', same: 'Same-day ACH', ach: 'Standard ACH', wire: 'Wire transfer' };
  const dayLabel = d => { const x = new Date(d), t = new Date(), s0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()), y = new Date(s0); y.setDate(y.getDate() - 1), xd = new Date(x.getFullYear(), x.getMonth(), x.getDate()); if (+xd === +s0) return 'Today'; if (+xd === +y) return 'Yesterday'; return x.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: x.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); };
  const tm = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let F = { q: '', status: '', rows: [], total: 0 };
  const row = t => { const st = String(t.status).toLowerCase(); return `<div class="tx" role="button" tabindex="0" onclick="receipt(${t.id})" onkeydown="if(event.key==='Enter')receipt(${t.id})"><span class="av" style="background:${avc(t.recipient_name)}">${esc(t.recipient_name[0])}</span><span class="m"><span class="tn">${esc(t.recipient_name)}</span><span class="ts">${esc(String(t.recipient_bank).split(' \u00b7 RTN ')[0])} \u00b7 ${esc(MLAB[t.delivery_method] || 'Transfer')} \u00b7 ${tm(t.created_at)}</span></span><span class="r"><b>\u2212${money(Number(t.amount) + Number(t.fee || 0))}</b><small class="${st}">${esc(t.status_label || (t.status[0] + t.status.slice(1).toLowerCase()))}</small></span></div>`; };
  const list = () => { let last = ''; return F.rows.map(t => { const d = dayLabel(t.created_at), h = d !== last ? `<div class="daylab">${esc(d)}</div>` : ''; last = d; return h + row(t); }).join('') || '<p class="muted" style="padding:24px 0;text-align:center">No transactions match your search.</p>'; };
  const load = async (reset) => {
    if (reset) { F.rows = []; }
    const r = await api(`/api/customer/activity?limit=25&offset=${F.rows.length}&q=${encodeURIComponent(F.q)}&status=${F.status}`);
    F.rows = F.rows.concat(r.transactions); F.total = r.total;
    const host = $('#act-list'); if (!host) return; host.innerHTML = list();
    const more = $('#act-more'); if (more) { more.style.display = F.rows.length < F.total ? '' : 'none'; more.textContent = `Load more (${F.total - F.rows.length} remaining)`; }
    const c = $('#act-count'); if (c) c.textContent = `${F.total} transaction${F.total === 1 ? '' : 's'}`;
  };
  const csv = () => { const head = ['Date', 'Reference', 'Recipient', 'Bank', 'Delivery', 'Status', 'Amount', 'Fee', 'Memo']; const rows = F.rows.map(t => [new Date(t.created_at).toISOString(), t.reference, t.recipient_name, String(t.recipient_bank).split(' \u00b7 RTN ')[0], MLAB[t.delivery_method] || '', t.status, Number(t.amount).toFixed(2), Number(t.fee || 0).toFixed(2), t.description || '']); const text = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'mountain-hills-activity.csv'; document.body.appendChild(a); a.click(); a.remove(); };
  transactions = async () => {
    try {
      F = { q: '', status: '', rows: [], total: 0 };
      app.innerHTML = window.__shell('transactions', `<header class="dash-head"><div><span class="kicker muted-kicker">Account history</span><h1>Activity</h1></div><button class="secondary-button" id="act-csv">Export CSV</button></header>
        <section class="card2 act"><div class="act-bar"><div class="act-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="act-q" placeholder="Search name, reference or memo" autocomplete="off"></div><div class="mk-tabs" id="act-f" style="margin:0">${[['', 'All'], ['COMPLETED', 'Completed'], ['PENDING', 'Pending'], ['PROCESSING', 'Processing'], ['FAILED', 'Failed']].map(f => `<button data-s="${f[0]}" class="${f[0] === '' ? 'on' : ''}">${f[1]}</button>`).join('')}</div></div><div class="muted" id="act-count" style="font-size:13px;margin:6px 0 0"></div><div id="act-list"><p class="muted" style="padding:24px 0">Loading\u2026</p></div><button class="secondary-button" id="act-more" style="width:100%;margin-top:16px;display:none"></button></section>`);
      let tmr; $('#act-q').oninput = e => { clearTimeout(tmr); tmr = setTimeout(() => { F.q = e.target.value.trim(); load(true); }, 280); };
      $$('#act-f button').forEach(b => b.onclick = () => { $$('#act-f button').forEach(x => x.classList.toggle('on', x === b)); F.status = b.dataset.s; load(true); });
      $('#act-more').onclick = () => load(false); $('#act-csv').onclick = csv;
      await load(true);
    } catch (e) { toast(e.message); }
  };
}, 0);
