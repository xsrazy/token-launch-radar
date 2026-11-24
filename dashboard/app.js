// Token Radar dashboard: renders window.RADAR with no network.
//
// Views: the pre-token board (ranked by implied value) and the live-token set (already trading,
// shown with market values, never ranked). Filters: search, category, chain. Sort: implied value,
// TVL, seven-day growth, age or name, from the select or by clicking a column header. Every board
// row opens a detail view with the value breakdown and the protocol's farm plan.
//
// Deep links, read on load and on hash change:
//   #row-<slug>   opens the detail view for one protocol
//   #q=<text>     sets the search box
//   #cat=<name>   sets the category filter
//   #chain=<name> sets the chain filter

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) {
    document.body.insertAdjacentHTML('beforeend', '<p style="color:#f87171">No data: data.js did not load.</p>');
    return;
  }

  var state = { tab: 'board', q: '', cat: '', chain: '', sort: 'implied', dir: -1 };

  function $(id) { return document.getElementById(id); }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function moneyFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + s + '</span>';
  }

  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.floor(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function chainsText(chains) {
    if (!chains || chains.length === 0) return '—';
    var shown = chains.slice(0, 3).join(', ');
    return chains.length > 3 ? shown + ' +' + (chains.length - 3) : shown;
  }

  // ---- summary strip ----

  function renderKpis() {
    $('asof').textContent = D.as_of;
    var top = D.rows.length > 0 ? D.rows[0].implied_value_usd : 0;
    $('kpis').innerHTML =
      '<div class="kpi"><div class="n"><em>' + D.watchlist_size + '</em> / ' + D.watchlist_size + '</div><div class="l">Watchlist protocols covered</div></div>' +
      '<div class="kpi"><div class="n">' + D.board_size + '</div><div class="l">Protocols on the board</div></div>' +
      '<div class="kpi"><div class="n">' + D.early_size + '</div><div class="l">Early finds below the floor</div></div>' +
      '<div class="kpi"><div class="n">' + money(top) + '</div><div class="l">Highest implied value</div></div>';
  }

  // ---- filters ----

  function fillSelect(el, values) {
    var counts = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); });
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n;
      o.textContent = n + ' (' + counts[n] + ')';
      el.appendChild(o);
    });
  }

  function renderFilters() {
    var cats = [];
    var chains = [];
    D.rows.forEach(function (r) {
      if (r.category) cats.push(r.category);
      (r.chains || []).forEach(function (c) { chains.push(c); });
    });
    fillSelect($('cat'), cats);
    fillSelect($('chain'), chains);
  }

  // ---- board ----

  function sortRows(rows) {
    var key = state.sort;
    var dir = state.dir;
    return rows.slice().sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = a.implied_value_usd - b.implied_value_usd;
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d === null ? -Infinity : a.change_7d) - (b.change_7d === null ? -Infinity : b.change_7d);
      else if (key === 'age') d = (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days);
      else if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      if (d === 0) d = a.rank - b.rank;
      return key === 'name' ? d : d * dir;
    });
  }

  function filteredBoard() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) === -1) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function filteredLive() {
    var q = state.q.trim().toLowerCase();
    return D.live.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) === -1) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function headerCell(label, key, num) {
    var arrow = state.sort === key ? '<span class="arrow">' + (state.dir === -1 ? ' ↓' : ' ↑') + '</span>' : '';
    return '<th class="sortable' + (num ? ' num' : '') + '" data-sort="' + key + '">' + label + arrow + '</th>';
  }

  function renderBoard() {
    var rows = sortRows(filteredBoard());
    var max = rows.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 0);
    var html = '<thead><tr><th>#</th><th>Protocol</th><th>Chains</th>' +
      headerCell('TVL', 'tvl', true) + headerCell('7d', 'growth', true) +
      headerCell('Implied value', 'implied', true) + headerCell('Age', 'age', true) + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var w = max > 0 ? Math.max(2, Math.round((r.implied_value_usd / max) * 100)) : 0;
      var badge = r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '';
      html += '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="rank' + (r.rank <= 3 ? ' top3' : '') + '">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + badge + '<div class="sub">' + esc(r.category || 'Uncategorised') + '</div></td>' +
        '<td>' + esc(chainsText(r.chains)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num"><span class="bar"><i style="width:' + w + '%"></i><span>' + money(r.implied_value_usd) + '</span></span></td>' +
        '<td class="num">' + ageText(r.age_days) + '</td></tr>';
    });
    html += '</tbody>';
    $('board').innerHTML = html;
    $('count').textContent = rows.length + ' of ' + D.board_size + ' protocols';
    $('empty').hidden = rows.length > 0;
    $('live-note').hidden = true;
    bindRows();
  }

  function renderLive() {
    var rows = filteredLive().slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
    var html = '<thead><tr><th>#</th><th>Protocol</th><th>Chains</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      html += '<tr class="live-row"><td class="rank">' + (i + 1) + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><div class="sub">' + esc(r.category || 'Uncategorised') + '</div></td>' +
        '<td>' + esc(chainsText(r.chains)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td></tr>';
    });
    html += '</tbody>';
    $('board').innerHTML = html;
    $('count').textContent = rows.length + ' of ' + D.live_size + ' live-token protocols';
    $('empty').hidden = rows.length > 0;
    $('live-note').hidden = false;
  }

  function render() {
    if (state.tab === 'board') renderBoard();
    else renderLive();
  }

  function bindRows() {
    var trs = document.querySelectorAll('#board tbody tr[data-slug]');
    trs.forEach(function (tr) {
      tr.addEventListener('click', function () { openModal(tr.getAttribute('data-slug')); });
    });
    var ths = document.querySelectorAll('#board th.sortable');
    ths.forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
        $('sort').value = state.sort;
        render();
      });
    });
  }

  // ---- detail view ----

  function parseStep(s) {
    var m = s.match(/^(.*?)\s+Cost:\s*(.*?)\.\s+Time:\s*(.*?)\.?$/);
    if (!m) return { action: s, cost: '', time: '' };
    return { action: m[1], cost: m[2], time: m[3] };
  }

  function openModal(slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { r = D.rows[i]; break; }
    if (!r) return;
    var steps = r.farm_steps.map(function (s) {
      var p = parseStep(s);
      return '<li>' + esc(p.action) +
        '<span class="chips"><span class="chip">Cost: <b>' + esc(p.cost) + '</b></span>' +
        '<span class="chip">Time: <b>' + esc(p.time) + '</b></span></span></li>';
    }).join('');
    $('modal-body').innerHTML =
      '<h2 id="modal-title">#' + r.rank + ' ' + esc(r.name) + (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="cats">' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ') || '—') + ' · records no token</p>' +
      '<div class="stats">' +
      '<div class="stat"><div class="v">' + moneyFull(r.tvl_usd) + '</div><div class="k">TVL</div></div>' +
      '<div class="stat"><div class="v">' + pct(r.change_7d) + '</div><div class="k">TVL change, 7 days</div></div>' +
      '<div class="stat"><div class="v">' + (r.listed_at || '—') + '</div><div class="k">Tracked since</div></div>' +
      '<div class="stat"><div class="v">' + (r.age_days === null ? 'Unknown' : r.age_days + ' days') + '</div><div class="k">Age at snapshot</div></div>' +
      '</div>' +
      '<h3>Value breakdown</h3>' +
      '<table class="breakdown"><tbody>' +
      '<tr><td>Base: TVL × 0.30</td><td>' + moneyFull(r.base_value_usd) + '</td></tr>' +
      '<tr><td>Growth multiplier (7d ' + (r.change_7d === null ? 'unreported' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + ')</td><td>×' + r.growth_multiplier.toFixed(4) + '</td></tr>' +
      '<tr><td>Maturity multiplier</td><td>×' + r.maturity_multiplier.toFixed(4) + '</td></tr>' +
      '<tr><td>Breadth multiplier (' + (r.chains || []).length + ' chains)</td><td>×' + r.breadth_multiplier.toFixed(4) + '</td></tr>' +
      '<tr class="total"><td>Implied value</td><td>' + moneyFull(r.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan</h3><ol class="steps">' + steps + '</ol>';
    $('backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('backdrop').hidden = true;
    document.body.style.overflow = '';
  }

  // ---- wiring ----

  $('tab-board').addEventListener('click', function () {
    state.tab = 'board';
    $('tab-board').classList.add('active');
    $('tab-live').classList.remove('active');
    render();
  });
  $('tab-live').addEventListener('click', function () {
    state.tab = 'live';
    $('tab-live').classList.add('active');
    $('tab-board').classList.remove('active');
    render();
  });
  $('q').addEventListener('input', function () { state.q = this.value; render(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; render(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; render(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; state.dir = this.value === 'name' ? 1 : -1; render(); });
  $('modal-close').addEventListener('click', closeModal);
  $('backdrop').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function applyHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = kv[0];
      var v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      if (k === 'row' && v) openModal(v);
      else if (k === 'q') { state.q = v; $('q').value = v; }
      else if (k === 'cat') { state.cat = v; $('cat').value = v; }
      else if (k === 'chain') { state.chain = v; $('chain').value = v; }
      else if (k === 'tab' && (v === 'board' || v === 'live')) {
        state.tab = v;
        $(v === 'board' ? 'tab-board' : 'tab-live').click();
      }
    });
    render();
  }
  window.addEventListener('hashchange', applyHash);

  renderKpis();
  renderFilters();
  render();
  applyHash();
})();
