/* ===== New screens (Polaris web components, Shopify's own app UI). Data functions above are unchanged. ===== */
let page = new URLSearchParams(location.search).get('p') || 'overview', metric = null;
const PAGES = { overview: pgOverview, placements: pgPlacements, ab: pgAB, odoo: pgOdoo };
const view_ = () => (page === 'ab' ? 'ab' : page);
function go(p) { page = p; place = null; view = view_(); history.pushState(null, '', '?p=' + p); window.scrollTo(0, 0); if (last) show(last); }
window.addEventListener('popstate', () => { page = new URLSearchParams(location.search).get('p') || 'overview'; place = new URLSearchParams(location.search).get('src') || null; view = view_(); if (last) show(last); });
view = view_();
const show = (d) => {
  charts.forEach((c) => c.destroy()); charts = [];
  const app = document.getElementById('app');
  if (d.shErr) { app.innerHTML = `<s-page heading="Odoo Cross Sells"><s-banner tone="critical" heading="Could not read Shopify">${esc(d.shErr)}<s-button slot="secondary-actions" onclick="load()">Try again</s-button></s-banner></s-page>`; return; }
  (PAGES[page] || pgOverview)(d, app);
  try { sessionStorage.setItem('okb_last', JSON.stringify(d)); } catch (e) { /* cache is a convenience only */ }
};

/* ---------- shared pieces ---------- */
const PURPLE = '#8F7EF0', PINK = '#D96BC5';
const PLACE = {
  pick: ['Product page picks', '3 add-ons under Add to cart, in the shopper\'s size'],
  best: ['Best-seller tabs', 'Clothing, toys, baby… tabs on the product page'],
  drawer: ['Cart add-ons', 'Suggestions inside the cart drawer'],
  near: ['Sold out: closest match', 'In-stock lookalike when a size is sold out'],
  qv: ['Quick view', 'Pop-up opened from a tile'], okb: ['Other', 'Older tags'] };
const today = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const dshort = (x) => new Date(x + (x.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const tstamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const arrow = (up) => (up >= 0 ? '↑' : '↓');
const chg = (up, dp = 2) => up == null ? '<span class="muted">–</span>' : `<span class="${up >= 0 ? 'up' : 'dn'}">${up >= 0 ? '+' : '−'}${Math.abs(up).toFixed(dp)}% ${arrow(up)}</span>`;
const tile = (label, value, sub = '') => `<div class="tile"><s-text tone="subdued">${label}</s-text><div class="tv">${value}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div>`;
const header = (title, sub, actions = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="pa">${actions}</div></div>`;
const inAdmin = window.top !== window;   /* inside Shopify the sidebar (ui-nav-menu) is the menu */
const nav = () => inAdmin ? '' : `<div class="tabs">${[['overview', 'Overview'], ['placements', 'Cross sells'], ['ab', 'A/B test'], ['odoo', 'Shops vs online']].map(([k, l]) => `<button class="${page === k ? 'on' : ''}" onclick="go('${k}')">${l}</button>`).join('')}</div>`;
const card = (title, body, right = '') => `<section class="card">${title ? `<div class="ch"><h2>${title}</h2>${right ? `<div class="cr">${right}</div>` : ''}</div>` : ''}${body}</section>`;
const empty = (t) => `<div class="empty">${t}</div>`;
const how = (t) => `<details class="how"><summary>How this is worked out</summary><p>${t}</p></details>`;
const liveNote = (A) => A?.live ? `Live · read ${new Date(A.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Last night';

/* groups of the running test, with Shopify's session counts joined on */
function groupsOf(S) {
  const A = S.A; if (!A) return null;
  const sesBy = Object.fromEntries((S.ses || []).map((r) => [String(r.rollout_treatment_id), r]));
  const G = {}; for (const [id, g] of Object.entries(A.groups)) { const r = sesBy[id] || {}; G[id] = { ...g, id, sessions: +r.sessions || 0, atc: +r.sessions_with_cart_additions || 0, co: +r.sessions_that_reached_checkout || 0, conv: +r.sessions_that_completed_checkout || 0 }; }
  const ids = Object.keys(G), running = !!A.rollout;
  const C = running ? G[ids.find((i) => G[i].label === 'Control')] : G[ids[0]], T = running ? G[ids.find((i) => G[i].label === 'Test')] : null;
  return { A, G, C, T, running };
}

/* ONE source for every cross-sell number on every page: the saved rows for days before today + today's orders read live.
   (Before 24 Nov the Overview and the A/B page added these up differently and showed two totals for the same thing.) */
function xsAgg(S, from) {
  const O = S.online?.jsonValue, t = today(), P = {}, daily = {};
  const add = (src, k, v) => { (P[src] ||= { views: 0, clicks: 0, adds: 0, orders: 0, units: 0, rev: 0 })[k] += v || 0; };
  for (const r of (O?.rows || [])) if (r.d >= from && r.d <= t) {
    add(r.src, 'views', r.views); add(r.src, 'clicks', r.clicks); add(r.src, 'adds', r.adds);
    if (r.d < t) { add(r.src, 'orders', r.orders); add(r.src, 'units', r.units); add(r.src, 'rev', r.rev); daily[r.d] = (daily[r.d] || 0) + r.rev; } }
  for (const [src, x] of Object.entries(S.xs?.by || {})) { add(src, 'orders', x.orders); add(src, 'units', x.units); add(src, 'rev', x.rev); daily[t] = (daily[t] || 0) + x.rev; }
  const X = { views: 0, clicks: 0, adds: 0, orders: 0, units: 0, rev: 0 }; for (const x of Object.values(P)) for (const k in X) X[k] += x[k];
  /* order count across placements: an order with two placements counts once */
  const cd = (iso) => new Date(Date.parse(iso) + 2 * 3600e3).toISOString().slice(0, 10);
  const lines = [...(O?.lines || []).filter((l) => cd(l[1]) >= from && cd(l[1]) < t), ...(S.xs?.lines || []).filter((l) => cd(l[1]) >= t)];
  X.orders = new Set(lines.map((l) => l[0])).size || X.orders;
  /* GA4 visits: all / saw a tile / added one. GA4 cannot split visits by test group, so B's visits = half of all (50/50 test). */
  const V = (O?.visits || []).filter((v) => v.d >= from && v.d <= t).reduce((a, v) => ({ all: a.all + v.all, seen: a.seen + v.seen, added: a.added + v.added }), { all: 0, seen: 0, added: 0 });
  const byO = {}; for (const l of lines) (byO[l[6]] ||= new Set()).add(l[0]); for (const s in P) P[s].ord = byO[s]?.size ?? P[s].orders;
  return { P, X, V, daily, lines, ga4_at: O?.ga4_at || O?.at, liveToday: !!S.xs };
}
const fromOf = (S) => S.A?.rollout ? S.A.start : (S.online?.jsonValue?.start || today());

/* product photos for titles / handles (one Shopify call, cached) */
const PH = {};
async function photos(titles) {
  const need = [...new Set(titles)].filter((t) => t && !(t in PH)).slice(0, 25); if (!need.length) return;
  const q = 'query(' + need.map((_, i) => `$q${i}: String!`).join(', ') + ') {' + need.map((_, i) => `p${i}: products(first: 1, query: $q${i}) { nodes { handle legacyResourceId featuredMedia { preview { image { url(transform: { maxWidth: 120 }) } } } } }`).join(' ') + '}';
  const v = Object.fromEntries(need.map((t, i) => [`q${i}`, /^[a-z0-9-]+$/.test(t) ? `handle:${t}` : `title:"${t.replace(/"/g, '\\"')}"`]));
  try { const r = await AQ(q, v); need.forEach((t, i) => { const n = r[`p${i}`]?.nodes?.[0]; PH[t] = n ? { img: n.featuredMedia?.preview?.image?.url, handle: n.handle, id: n.legacyResourceId } : null; }); }
  catch (e) { need.forEach((t) => { PH[t] = null; }); }
}
const prod = (t, sub = '') => { const p = PH[t]; const name = /^[a-z0-9-]+$/.test(t) ? pretty(t) : esc(t);
  return `<div class="prod">${p?.img ? `<img src="${esc(p.img)}" alt="">` : '<span class="noimg"></span>'}<div>${p?.id ? `<a href="shopify://admin/products/${p.id}" target="_top">${name}</a>` : name}${sub ? `<div class="ts">${sub}</div>` : ''}</div></div>`; };
let photoAsk = 0;
function withPhotos(keys) { const missing = keys.filter((t) => t && !(t in PH)); if (!missing.length) return; const n = ++photoAsk; photos(missing).then(() => { if (n === photoAsk && last) show(last); }); }

function barChart(id, labels, vals, fmt) {
  charts.push(new Chart(document.getElementById(id), { type: 'bar', data: { labels, datasets: [{ data: vals, backgroundColor: [PURPLE, PINK], borderRadius: 4, maxBarThickness: 46 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.y) } } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => fmt(v), maxTicksLimit: 5 } } } } }));
}

/* ---------- Overview ---------- */
function pgOverview(d, app) {
  const S = d.sh || {}, g = groupsOf(S), from = fromOf(S), { P, X, V, daily, ga4_at } = xsAgg(S, from);
  const T = g?.T, srcs = Object.keys(P).sort((a, b) => P[b].rev - P[a].rev || P[b].views - P[a].views);
  const ab = g?.running ? abSummary(g, S) : null;
  let h = header('Odoo Cross Sells', `Add-ons picked from Odoo baskets · since the test started ${dshort(from)} · shown to the Test group only`, `<s-button onclick="exportOnline()">Export</s-button>`) + nav();
  h += `<div class="g4">${tile('Cross-sell revenue', egp(X.rev), T ? `${pct(X.rev, T.rev)} of B’s revenue (${egp(T.rev)})` : '')}${tile('Attach rate', T ? pct(X.orders, T.orders) : '–', T ? `B orders that include a cross-sell item: ${num(X.orders)} of ${num(T.orders)}` : '')}${tile('Items sold from tiles', num(X.units), T ? `${pct(X.units, T.units)} of B’s ${num(T.units)} items` : '')}${tile('Revenue per 1,000 tiles seen', X.views ? egp(X.rev / X.views * 1000) : '–', `${num(X.views)} tiles seen`)}</div>`;
  h += `<div class="g4">${tile('Visits that saw a tile', V.all ? pct(V.seen, V.all / 2) : '–', V.all ? `${num(V.seen)} of ≈${num(V.all / 2)} B visits (GA4)` : 'GA4 visits arrive with the next refresh')}${tile('Click rate', pct(X.clicks, X.views), `tiles clicked ÷ tiles seen: ${num(X.clicks)} of ${num(X.views)}`)}${tile('Take rate', pct(X.adds, X.views, 2), `tiles added to cart ÷ tiles seen: ${num(X.adds)} of ${num(X.views)}`)}${tile('Added → bought', pct(X.units, X.adds), `${num(X.units)} of ${num(X.adds)} added items were bought`)}</div>`;
  if (ab) h += card('A/B test', `<div class="abs"><div><div class="row"><b>${esc(ab.name)}</b> <s-badge tone="info">Running</s-badge> <s-badge>${ab.verdict}</s-badge></div>
      <div class="ts">Day ${ab.day} of ${ab.of} · ${num(ab.sessions)} visitors · goal: ${ab.goal}</div>
      <div class="g3 mt">${tile('Improvement', chg(ab.up))}${tile('Confidence B is better', ab.win, 'call it at 95%')}${tile('Orders so far', `${num(ab.orders)}`, ab.need)}</div>${trustBar(trust(S.goal?.value && GOALS[S.goal.value] ? S.goal.value : 'rps', g), ab.goal)}</div>
      <div class="cta"><s-button variant="primary" onclick="go('ab')">View results</s-button></div></div>`);
  const F = [['Seen', X.views], ['Clicked', X.clicks], ['Added to cart', X.adds], ['Sold', X.units]], fmax = Math.max(1, ...F.map((x) => x[1]));
  h += `<div class="g2">` + card('From tile to sale', `<div class="funnel">${F.map((x, i) => `<div class="fr"><span>${x[0]}</span><div class="ftrack"><i style="width:${Math.max(0.8, x[1] / fmax * 100)}%;opacity:${1 - i * 0.2}"></i></div><b>${num(x[1])}</b><em>${i ? pct(x[1], F[i - 1][1]) : ''}</em></div>`).join('')}</div>
      <div class="ts mt">Seen → clicked ${pct(X.clicks, X.views)} · clicked → added ${pct(X.adds, X.clicks)} · added → sold ${pct(X.units, X.adds)}</div>`, `<s-text tone="subdued">tiles seen and clicks: GA4${ga4_at ? ', ' + tstamp(ga4_at) : ''}</s-text>`)
    + card('Cross-sell revenue per day', Object.keys(daily).length ? '<div class="chart"><canvas id="c1"></canvas></div>' : empty('No cross-sell sales yet.')) + '</div>';
  h += card('Placements', placeTable(P, X, T), '<s-text tone="subdued">click a placement for its products and orders</s-text>');
  h += how('Cross-sell revenue = order lines added from one of our tiles (hidden line tag _okb), web orders placed since the test started, today read live from Shopify. Refunds are not deducted. Tiles seen / clicks / adds come from GA4 (refreshed every 3 hours; GA4 itself runs a few hours behind). Only the Test group sees the tiles, so shares are of Test-group revenue and orders.');
  app.innerHTML = `<div class="wrap">${h}</div>`;
  const days = Object.keys(daily).sort();
  if (days.length) charts.push(new Chart(document.getElementById('c1'), { type: 'bar', data: { labels: days.map(dshort), datasets: [{ label: 'Cross-sell revenue', data: days.map((x) => daily[x]), backgroundColor: PINK, borderRadius: 4, maxBarThickness: 60 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => egp(c.parsed.y) } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => num(v), maxTicksLimit: 5 } } } } }));
}

function placeTable(P, X, T) {
  const srcs = Object.keys(P).sort((a, b) => P[b].rev - P[a].rev || P[b].views - P[a].views);
  if (!srcs.length) return empty('Nothing recorded yet.');
  const H = (t, n) => `<th class="${n ? 'n' : ''}">${t}</th>`;
  return `<div class="tw"><table class="pt"><thead><tr>${H('Placement')}${H('Seen', 1)}${H('% of tiles seen', 1)}${H('Click rate', 1)}${H('Take rate', 1)}${H('Orders', 1)}${H('Attach rate', 1)}${H('Revenue', 1)}${H('% of cross-sell revenue', 1)}${H('Per 1,000 seen', 1)}</tr></thead><tbody>` +
    srcs.map((s) => { const x = P[s]; return `<tr onclick="drill('${s}')"><td><b>${esc(PLACE[s]?.[0] || s)}</b> <span class="chev">›</span><div class="ts">${esc(PLACE[s]?.[1] || '')}</div></td><td class="n">${num(x.views)}</td><td class="n">${pct(x.views, X.views)}</td><td class="n">${pct(x.clicks, x.views)}</td><td class="n">${pct(x.adds, x.views, 2)}</td><td class="n">${num(x.ord)}</td><td class="n">${T ? pct(x.ord, T.orders) : '–'}</td><td class="n">${egp(x.rev)}</td><td class="n"><div class="share"><i style="width:${X.rev ? 100 * x.rev / X.rev : 0}%"></i></div>${pct(x.rev, X.rev)}</td><td class="n">${x.views ? egp(x.rev / x.views * 1000) : '–'}</td></tr>`; }).join('') +
    `<tr class="tot"><td><b>All placements</b></td><td class="n">${num(X.views)}</td><td class="n">100%</td><td class="n">${pct(X.clicks, X.views)}</td><td class="n">${pct(X.adds, X.views, 2)}</td><td class="n">${num(X.orders)}</td><td class="n">${T ? pct(X.orders, T.orders) : '–'}</td><td class="n">${egp(X.rev)}</td><td class="n">100%</td><td class="n">${X.views ? egp(X.rev / X.views * 1000) : '–'}</td></tr></tbody></table></div>
    <div class="ts mt">Take rate = added to cart ÷ tiles seen · Attach rate = share of B orders with an item from this placement</div>`;
}
let place = new URLSearchParams(location.search).get('src') || null;
function drill(s) { place = s; page = 'placements'; view = 'placements'; history.pushState(null, '', '?p=placements' + (s ? '&src=' + s : '')); window.scrollTo(0, 0); if (last) show(last); }
const PREVIEW = 'https://shop-ourkids.com/?preview_theme_id=156358639795';
const PV = (h) => `https://shop-ourkids.com/products/${h}?preview_theme_id=156358639795`;
const SHOT = {   /* what shoppers in B see (captured from the Test theme, 24 Nov) + a live preview to try it */
  pick: ['img/pick.jpg', PV('14103-grey-long-sleeved-thermal-set-1'), 'Any product page, under Add to cart'],
  best: ['img/best.jpg', PV('14103-grey-long-sleeved-thermal-set-1'), 'Any product page, further down'],
  drawer: ['img/drawer.jpg', PV('14103-grey-long-sleeved-thermal-set-1'), 'Add anything to cart, the drawer opens'],
  near: ['img/near.jpg', PV('4761-09-thermal-set'), 'Pick a sold-out size (here 3-4y)'] };
const shotCard = (s) => `<div class="shot"><div class="row"><b>${PLACE[s][0]}</b><span class="sp"></span><s-button href="${SHOT[s][1]}" target="_blank" variant="tertiary">Try it live ↗</s-button></div><div class="ts">${SHOT[s][2]}</div><img src="${SHOT[s][0]}" alt="${PLACE[s][0]} as shoppers see it" loading="lazy"></div>`;
/* ---------- Cross sells: placements, products, orders ---------- */
function pgPlacements(d, app) {
  const S = d.sh || {}, from = fromOf(S), all = xsAgg(S, from), { P } = all, O = S.online?.jsonValue, T = groupsOf(S)?.T;
  const lines = place ? all.lines.filter((l) => l[6] === place) : all.lines, X = place ? { ...(P[place] || {}), orders: P[place]?.ord || 0 } : all.X;
  const byT = {}; for (const l of lines) { const x = byT[l[3]] ||= { title: l[3], orders: new Set(), units: 0, rev: 0, src: {} }; x.orders.add(l[0]); x.units += l[4]; x.rev += l[5]; x.src[l[6]] = 1; }
  const top = Object.values(byT).sort((a, b) => b.rev - a.rev).slice(0, 12);
  const span = Math.round((Date.parse(today()) - Date.parse(from)) / 864e5) + 1, seen = (O?.tops?.[String([7, 14, 30, 60].find((n) => n >= span) || 60)]?.seen || []).slice(0, 10);
  const ords = {}; for (const l of lines) { const o = ords[l[0]] ||= { name: l[0], ts: l[1], total: l[2], items: [] }; o.items.push(l); }
  const recent = Object.values(ords).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  withPhotos([...top.map((x) => x.title), ...seen.map((x) => x.handle), ...recent.flatMap((o) => o.items.map((l) => l[3])), ...all.lines.map((l) => l[3])]);
  const pname = place ? (PLACE[place]?.[0] || place) : 'All placements';
  let h = header('Cross sells', `${esc(pname)} · since the test started ${dshort(from)}`, `<s-button href="${PREVIEW}" target="_blank">View on store</s-button><s-button onclick="exportOnline()">Export</s-button>`) + nav();
  h += '<div class="g5">' + [null, ...Object.keys(PLACE).filter((s) => P[s] || ['pick', 'best', 'drawer', 'near'].includes(s)).slice(0, 4)].map((s) => { const x = s ? (P[s] || { views: 0, clicks: 0, adds: 0, ord: 0, rev: 0 }) : { ...all.X, ord: all.X.orders };
    return `<div class="tile pick${place === s ? ' on' : ''}" onclick="drill(${s ? `'${s}'` : 'null'})"><b>${s ? PLACE[s][0] : 'All placements'}</b>
      <div class="tv">${egp(x.rev)}</div><div class="ts">${pct(x.rev, all.X.rev)} of cross-sell revenue</div><div class="ts">${num(x.ord)} orders${T ? ` · ${pct(x.ord, T.orders)} attach` : ''} · ${pct(x.adds, x.views, 2)} take</div></div>`; }).join('') + '</div>';
  h += card(place ? 'What shoppers see' : 'What shoppers see in B', place && SHOT[place] ? `<div class="shots one">${shotCard(place)}</div>` : `<div class="shots">${['pick', 'best', 'drawer', 'near'].map(shotCard).join('')}</div>`, '<s-text tone="subdued">the Control group sees none of these</s-text>');
  h += `<div class="g4">${tile('Tiles seen', num(X.views), `${pct(X.views, all.X.views)} of all tiles seen`)}${tile('Click rate', pct(X.clicks, X.views), `tiles clicked ÷ tiles seen · ${num(X.clicks)} clicks`)}${tile('Take rate', pct(X.adds, X.views, 2), `tiles added to cart ÷ tiles seen · ${num(X.adds)} added`)}${tile('Attach rate', T ? pct(X.orders, T.orders) : '–', T ? `B orders with a cross-sell item · ${num(X.orders)} of ${num(T.orders)}` : '')}</div>`;
  const SB = O?.seen_by || {}, sbOf = (t) => SB[PH[t]?.handle] || null;
  h += card('Best-selling cross sells', top.length ? `<div class="tw"><table class="pt"><thead><tr><th>Product</th><th class="n">Times shown</th><th class="n">Clicks</th><th class="n">Click rate</th><th class="n">Orders</th><th class="n">Units</th><th class="n">Sold per 1,000 shown</th><th class="n">Revenue</th></tr></thead><tbody>${top.map((x) => { const sb = sbOf(x.title);
      return `<tr class="nc"><td>${prod(x.title, Object.keys(x.src).map((s) => PLACE[s]?.[0] || s).join(', '))}</td><td class="n">${sb ? num(sb[0]) : '–'}</td><td class="n">${sb ? num(sb[1]) : '–'}</td><td class="n">${sb ? pct(sb[1], sb[0]) : '–'}</td><td class="n">${num(x.orders.size)}</td><td class="n">${num(x.units)}</td><td class="n">${sb && sb[0] ? (x.units / sb[0] * 1000).toFixed(1) : '–'}</td><td class="n">${egp(x.rev)}</td></tr>`; }).join('')}</tbody></table></div><div class="ts mt">Times shown = how often the product appeared in a tile since the test started, all placements (GA4). – = shown too rarely to be in GA4’s top 500.</div>` : empty('No cross-sell sales yet.'), `<s-text tone="subdued">${num(X.units)} items · ${egp(X.rev)}</s-text>`);
  const soldH = {}; for (const l of all.lines) { const hd = PH[l[3]]?.handle; if (hd) { const z = soldH[hd] ||= { u: 0, r: 0 }; z.u += l[4]; z.r += l[5]; } }
  h += card('Most shown', seen.length ? `<div class="tw"><table class="pt"><thead><tr><th>Product</th><th class="n">Shown</th><th class="n">Clicks</th><th class="n">Click rate</th><th class="n">Sold from tiles</th><th class="n">Sold per 1,000 shown</th><th class="n">Revenue</th></tr></thead><tbody>${seen.map((x) => { const z = soldH[x.handle];
      return `<tr class="nc"><td>${prod(x.handle)}</td><td class="n">${num(x.views)}</td><td class="n">${num(x.clicks)}</td><td class="n">${pct(x.clicks, x.views)}</td><td class="n">${z ? num(z.u) : 0}</td><td class="n">${z ? (z.u / x.views * 1000).toFixed(1) : '0.0'}</td><td class="n">${z ? egp(z.r) : '–'}</td></tr>`; }).join('')}</tbody></table></div><div class="ts mt">Take rate per product (added ÷ shown) starts once GA4 keeps the product on each add (not switched on yet).</div>` : empty('No tiles seen yet.'), `<s-text tone="subdued">${place ? 'all placements (GA4 does not split products by placement)' : 'GA4, every 3 hours'}</s-text>`);
  h += card('Orders with a cross sell', recent.length ? `<s-table><s-table-header-row><s-table-header>Order</s-table-header><s-table-header>Added from a tile</s-table-header><s-table-header>Placement</s-table-header><s-table-header format="numeric">Item value</s-table-header><s-table-header format="numeric">Order total</s-table-header></s-table-header-row><s-table-body>${recent.map((o) => `<s-table-row><s-table-cell><a href="shopify://admin/orders?query=${encodeURIComponent(o.name.replace('#', ''))}" target="_top"><b>${esc(o.name)}</b></a><div class="ts">${tstamp(o.ts)}</div></s-table-cell><s-table-cell>${o.items.map((l) => prod(l[3], `× ${l[4]}`)).join('')}</s-table-cell><s-table-cell>${[...new Set(o.items.map((l) => l[6]))].map((s) => `<s-badge>${esc(PLACE[s]?.[0] || s)}</s-badge>`).join(' ')}</s-table-cell><s-table-cell>${egp(o.items.reduce((a, l) => a + l[5], 0))}</s-table-cell><s-table-cell>${egp(o.total)}</s-table-cell></s-table-row>`).join('')}</s-table-body></s-table>` : empty('No orders with a cross sell yet.'), `<s-text tone="subdued">${num(X.orders)} orders · latest 15</s-text>`);
  h += how('An item counts when it was added from one of our tiles (it carries the hidden tag _okb on the order line). No time window, no view-through credit. Web orders only; refunds and cancellations are not deducted. Today’s orders are read live from Shopify; earlier days come from the job. Tiles seen and clicks: GA4 list events okb_&lt;placement&gt;, theme previews not counted.');
  app.innerHTML = `<div class="wrap">${h}</div>`;
}

/* ---------- A/B test (Essential A/B layout) ---------- */
const chanceTxt = (p) => p > 99.4 ? '>99%' : p < 0.6 ? '<1%' : p.toFixed(0) + '%';
function needFor(k, g) {      /* orders still needed to confirm a difference of the size seen so far (80% power) */
  const c = cmp(k, g.T, g.C); if (!c) return null; const se = Math.sqrt(val(k, g.T).se ** 2 + val(k, g.C).se ** 2), z = Math.abs(c.d) / (se || 1e-9);
  const have = g.T.orders + g.C.orders, need = z > 0.05 ? have * (2.8 / z) ** 2 : Infinity; return { have, need, z, c };
}
/* Intelligems-style reading: confidence = chance B is really better than A on the goal (call it at 95%),
   days left = time until a gap this size would reach 95% (80% of the time), never before 2 full weeks of data. */
function trust(k, g) {
  const A = g.A, c = cmp(k, g.T, g.C), n = needFor(k, g), t0 = Date.parse(A.start), now = Date.parse(today());
  const day = Math.max(1, Math.round((now - t0) / 864e5) + 1), end = Date.parse('2026-12-21'), leftTest = Math.round((end - now) / 864e5);
  const perDay = (g.C.orders + g.T.orders) / day, minDays = Math.max(0, 14 - day);
  let days = null, why = '';
  if (!c) { days = Math.max(minDays, perDay ? Math.ceil((60 - g.C.orders - g.T.orders) / perDay) : 0); why = 'needs 30 orders a side first'; }
  else if (c.pBeat >= 95 || c.pBeat <= 5) { days = minDays; why = minDays ? 'confident already; wait for 2 full weeks of data' : 'ready to call'; }
  else if (n.need === Infinity || !perDay) { days = Infinity; why = 'no difference yet to confirm'; }
  else { days = Math.max(minDays, Math.ceil(Math.max(0, n.need - n.have) / perDay)); why = `at today’s gap and ${num(perDay)} orders a day`; }
  const conf = c ? Math.max(c.pBeat, 100 - c.pBeat) : null, lead = c ? (c.pBeat >= 50 ? 'B' : 'A') : null;
  /* smallest lift the test can still confirm by its end date, at today's pace (the spread shrinks with more orders) */
  let mde = null; if (c && perDay) { const have = g.C.orders + g.T.orders, atEnd = have + perDay * Math.max(0, leftTest), se = Math.sqrt(val(k, g.T).se ** 2 + val(k, g.C).se ** 2) * Math.sqrt(have / atEnd); mde = 2.8 * se / val(k, g.C).v * 100; }
  if (days === Infinity || days > leftTest) why = mde ? `by 21 Dec it can only confirm a lift of ${mde.toFixed(0)}% or more; today’s gap is ${Math.abs(c.up).toFixed(1)}%` : why;
  const when = days === Infinity || days > leftTest ? `more than the ${leftTest} days the test has left` : days === 0 ? 'now' : `about ${days} day${days > 1 ? 's' : ''} (${new Date(now + days * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`;
  const have = g.C.orders + g.T.orders, atEnd = Math.round(have + perDay * Math.max(0, leftTest));
  const ordersTxt = !c ? `${num(have)} orders so far; a first reading needs 30 a side (${num(g.C.orders)} and ${num(g.T.orders)} now)`
    : n.need === Infinity ? `${num(have)} orders so far; no gap yet, so no number of orders confirms it`
    : `≈ ${num(n.need)} orders needed to trust today’s gap · ${num(have)} so far · ≈ ${num(atEnd)} by 21 Dec`;
  return { c, conf, lead, days, when, why, day, ordersTxt };
}
const trustBar = (t, lab) => `<div class="trust"><div><div class="ts">Confidence ${t.lead ? `${t.lead} is better` : ''} · ${lab}</div><div class="tv">${t.conf == null ? '–' : t.conf.toFixed(0) + '%'} <span class="of">of 95% needed</span></div>
  <div class="prog"><i style="width:${t.conf == null ? 0 : Math.min(100, t.conf / 95 * 100).toFixed(0)}%;background:${t.conf >= 95 ? '#0c5132' : '#303030'}"></i></div></div>
  <div><div class="ts">Time left until it can be trusted</div><div class="tv">${t.when}</div><div class="ts">${t.why}</div></div>
  <div class="ordn"><b>Orders needed</b> · ${t.ordersTxt}</div></div>`;
function abSummary(g, S) {
  const A = g.A, goal = S.goal?.value && GOALS[S.goal.value] ? S.goal.value : 'rps', c = cmp(goal, g.T, g.C), n = needFor(goal, g);
  const day = Math.max(1, Math.round((Date.parse(today()) - Date.parse(A.start)) / 864e5) + 1);
  const verdict = !c ? 'Collecting data' : c.lo > 0 ? 'Test is winning' : c.hi < 0 ? 'Test is losing' : 'Too early to call';
  return { name: 'Cross sells vs none', day, of: 28, sessions: g.T.sessions + g.C.sessions, goal: GOALS[goal].lab, up: c ? c.up : null, win: c ? chanceTxt(c.pBeat) : '–', orders: g.T.orders + g.C.orders, verdict,
    need: n ? (n.need === Infinity || n.need > 50 * n.have ? 'difference too small to confirm' : n.need <= n.have ? 'enough to call it' : `≈ ${num(n.need - n.have)} more to confirm`) : 'needs 30 a side' };
}
function pgAB(d, app) {
  const S = d.sh || {}, g = groupsOf(S);
  if (!g) { app.innerHTML = `<div class="wrap">${header('A/B test', '')}${nav()}${card('', empty(loading ? 'Loading the test from Shopify…' : 'No test numbers yet.'))}</div>`; return; }
  const { A, C, T, running } = g, goal = S.goal?.value && GOALS[S.goal.value] ? S.goal.value : 'rps', k = metric && GOALS[metric] ? metric : goal;
  const arms = running ? [[C, 'A', 'Original', 'Live theme, no cross sells'], [T, 'B', 'With cross sells', 'Basket builders theme']] : [[C, 'A', 'All shoppers', 'No test running']];
  const c = running ? cmp(k, T, C) : null, n = running ? needFor(k, g) : null;
  const day = Math.max(1, Math.round((Date.parse(today()) - Date.parse(A.start)) / 864e5) + 1), perDay = (C.orders + (T?.orders || 0)) / day;
  const status = running ? (A.rollout.status === 'ACTIVE' ? '<s-badge tone="info">Running</s-badge>' : `<s-badge>${esc(A.rollout.status.toLowerCase())}</s-badge>`) : '<s-badge>Not running</s-badge>';
  const verdict = !c ? '<s-badge>Collecting data</s-badge>' : c.lo > 0 ? '<s-badge tone="success">Test is winning</s-badge>' : c.hi < 0 ? '<s-badge tone="critical">Test is losing</s-badge>' : '<s-badge tone="warning">Too early to call</s-badge>';
  let h = header(`Cross sells vs none ${status} ${verdict}`, `${fdate(A.start)} – 21 Dec 2026 · 50% / 50% · Cairo time · ${liveNote(A)}`, `<s-button onclick="load()">Refresh</s-button><s-button onclick="exportAB()">Export</s-button>`) + nav();
  /* variant cards */
  if (running) h += `<div class="g2">${arms.map(([x, L, name, sub], i) => `<section class="card var"><div class="row"><span class="vdot" style="background:${i ? PINK : PURPLE}"></span><b>${L} ${name} – ${x.split}%</b><span class="sp"></span>${c && (i ? c.lo > 0 : c.hi < 0) ? '<s-badge tone="success">Winner</s-badge>' : ''}</div><div class="ts">${sub}</div>
      <ul class="sees">${i ? '<li>3 picks under Add to cart, in the shopper’s size</li><li>Best-seller tabs on the product page</li><li>Add-ons in the cart drawer</li><li>Closest in-stock match when a size is sold out</li>' : '<li>Today’s live site, unchanged</li><li>No add-on tiles anywhere</li>'}</ul></section>`).join('')}</div>`;
  /* analytics header + 4 tiles */
  const opts = Object.entries(GOALS).map(([kk, gg]) => `<option value="${kk}" ${kk === k ? 'selected' : ''}>${gg.lab}${kk === goal ? ' (test goal)' : ''}</option>`).join('');
  h += `<div class="ah"><h2>Analytics</h2><span class="sp"></span>${k !== goal && running ? `<s-button variant="tertiary" onclick="setGoal('${k}')">Make this the test goal</s-button>` : ''}<select class="sel" onchange="metric=this.value;show(last)">${opts}</select></div>`;
  h += `<div class="g4">${tile('Total visitors', num(C.sessions + (T?.sessions || 0)))}${tile('Test duration', `Day ${day} <span class="of">of 28</span>`)}${tile('Improvement', c ? chg(c.up) : '<span class="muted">–</span>', GOALS[k].lab)}${tile('Confidence B is better', c ? chanceTxt(c.pBeat) : '–', 'call it at 95% (or 5%: A is better)')}</div>`;
  /* progress to a verdict */
  if (running) {
    const have = C.orders + T.orders, need = !n ? 60 : Math.min(n.need, have * 50), done = !n ? Math.min(1, Math.min(C.orders, T.orders) / 30) : Math.min(1, have / need);
    const eta = n && n.need !== Infinity && n.need > have && perDay ? Math.ceil((n.need - have) / perDay) : null;
    const msg = !n ? `Needs 30 orders on each side before any reading (${num(C.orders)} and ${num(T.orders)} so far).`
      : n.need <= have ? 'Enough orders to call this difference.' : n.need > 50 * have ? `The difference so far is too small to confirm in this test. ${num(have)} orders so far.`
      : `About ${num(n.need)} orders needed to confirm a difference this size · ${num(have)} so far${eta ? ` · about ${eta} more days at today’s pace` : ''}.`;
    h += `<section class="card">${trustBar(trust(k, g), GOALS[k].lab)}<div class="ts mt">${msg}</div>
      ${c && c.lo < 0 && c.hi > 0 ? `<div class="warnb">⚠ Too early to call: B could still be anywhere from ${c.lo.toFixed(0)}% to +${c.hi.toFixed(0)}% on ${GOALS[k].lab.toLowerCase()}.</div>` : ''}</section>`;
  }
  /* variant table */
  h += `<section class="card tight"><s-table><s-table-header-row><s-table-header>Variant · confidence</s-table-header><s-table-header format="numeric">Visitors</s-table-header><s-table-header format="numeric">Add to carts</s-table-header><s-table-header format="numeric">ATC rate</s-table-header><s-table-header format="numeric">Checkouts</s-table-header><s-table-header format="numeric">Orders</s-table-header><s-table-header format="numeric">Conversion rate</s-table-header><s-table-header format="numeric">Revenue</s-table-header><s-table-header format="numeric">RPV</s-table-header><s-table-header format="numeric">AOV</s-table-header><s-table-header format="numeric">Items / order</s-table-header></s-table-header-row><s-table-body>` +
    arms.map(([x, L, name], i) => `<s-table-row><s-table-cell><b>${L} – ${name}</b> ${c ? `<s-badge>${chanceTxt(i ? c.pBeat : 100 - c.pBeat)}</s-badge>` : ''}</s-table-cell><s-table-cell>${num(x.sessions)}</s-table-cell><s-table-cell>${num(x.atc)}</s-table-cell><s-table-cell>${pct(x.atc, x.sessions, 2)}</s-table-cell><s-table-cell>${num(x.co)}</s-table-cell><s-table-cell>${num(x.orders)}</s-table-cell><s-table-cell>${pct(x.conv, x.sessions, 2)}</s-table-cell><s-table-cell>${egp(x.rev)}</s-table-cell><s-table-cell>${x.sessions ? 'EGP ' + (x.rev / x.sessions).toFixed(2) : '–'}</s-table-cell><s-table-cell>${x.orders ? egp(x.rev / x.orders) : '–'}</s-table-cell><s-table-cell>${x.orders ? (x.units / x.orders).toFixed(2) : '–'}</s-table-cell></s-table-row>`).join('') + '</s-table-body></s-table></section>';
  /* metric cards: goal first, then the rest */
  const keys = [goal, ...['cvr', 'atc', 'aov', 'upt', 'multi', 'checkout', 'aov_capped', 'cloth_toy', 'rps'].filter((x) => x !== goal)].slice(0, 9);
  h += '<div class="g3">' + keys.map((kk, i) => { const cc = running ? cmp(kk, T, C) : null;
    return `<section class="card mc${kk === k ? ' sel' : ''}" onclick="metric='${kk}';show(last)"><div class="row"><span>${GOALS[kk].lab}</span><span class="sp"></span>${kk === goal ? '<s-badge tone="info">Test goal</s-badge>' : ''}</div>
      <div class="mv">${cc ? chg(cc.up) : `<span class="muted" style="font-size:14px">${running ? 'needs 30 orders a side' : '–'}</span>`}</div>${cc ? `<div class="ts">confidence B is better: ${chanceTxt(cc.pBeat)}</div>` : '<div class="ts">&nbsp;</div>'}<div class="mchart"><canvas id="m${i}"></canvas></div></section>`; }).join('') + '</div>';
  /* baskets */
  const cats = [...new Set(arms.flatMap(([x]) => Object.keys(x.mix || {})))], tots = arms.map(([x]) => Object.values(x.mix || {}).reduce((a, b) => a + b, 0) || 1);
  const crow = cats.map((cn) => [cn, arms.map(([x], i) => (x.mix?.[cn] || 0) / tots[i])]).sort((a, b) => b[1][0] - a[1][0]);
  h += '<div class="g2">' + card('What baskets are made of', `<s-table><s-table-header-row><s-table-header>Category</s-table-header>${arms.map(([, L]) => `<s-table-header format="numeric">${L}</s-table-header>`).join('')}${running ? '<s-table-header format="numeric">B vs A</s-table-header>' : ''}</s-table-header-row><s-table-body>` +
    crow.map(([cn, v]) => { const rel = running && v[0] ? (v[1] - v[0]) / v[0] * 100 : null; return `<s-table-row><s-table-cell>${esc(cn)}</s-table-cell>${v.map((p) => `<s-table-cell>${(100 * p).toFixed(1)}%</s-table-cell>`).join('')}${running ? `<s-table-cell>${rel == null ? '–' : chg(rel, 0)}</s-table-cell>` : ''}</s-table-row>`; }).join('') + '</s-table-body></s-table>', '<s-text tone="subdued">share of each group’s revenue</s-text>')
    + card('Conversion rate by day', '<div class="chart"><canvas id="c2"></canvas></div>') + '</div>';
  if (running) { const { X } = xsAgg(S, A.start);
    h += card('What the cross sells did in B', `<div class="g4 flat">${tile('Cross-sell revenue', egp(X.rev), `${pct(X.rev, T.rev)} of B’s revenue`)}${tile('Orders with a cross sell', num(X.orders), `of ${num(T.orders)} B orders`)}${tile('Tiles seen', num(X.views), `${pct(X.clicks, X.views)} clicked`)}${tile('Added from tiles', num(X.adds), `${num(X.units)} sold`)}</div>`, `<s-button variant="tertiary" onclick="go('placements')">Details →</s-button>`); }
  h += how(`Shopify runs the test (a theme rollout: live theme vs the cross-sell copy) and counts visitors (sessions), add to carts, checkouts and conversions per group. Orders, value, items and categories come from Shopify sales per order: only orders placed since the test started, valued at checkout incl. delivery; later returns are left out. Improvement = B vs A on the chosen metric. Confidence = how likely B is really better than A on that metric, from each group’s own spread (the same reading Intelligems shows as probability to beat control). A result is trusted at 95% (or 5%, meaning A is better) and after at least 2 full weeks, so weekdays and weekends are both in. Time left = how long until a gap of the size seen so far would reach 95%, 80% of the time, at today’s order pace; if the gap is tiny that is longer than the test. Gross profit is not shown: Export, and it is worked out from Odoo.`);
  app.innerHTML = `<div class="wrap">${h}</div>`;
  keys.forEach((kk, i) => { const vs = arms.map(([x]) => val(kk, x)), G = GOALS[kk]; const fmt = G.p ? (v) => (100 * v).toFixed(2) + '%' : kk === 'upt' ? (v) => (+v).toFixed(2) : (v) => 'EGP ' + (+v).toFixed(kk === 'rps' ? 2 : 0);
    barChart('m' + i, arms.map(([, L, name]) => `${L} ${name}`), vs.map((v) => v ? v.v : 0), fmt); });
  const days_ = [...new Set((S.dly || []).map((r) => r.day))].sort();
  const series = (id) => days_.map((dd) => { const r = S.dly.find((x) => x.day === dd && String(x.rollout_treatment_id) === id); return r ? +(100 * r.conversion_rate).toFixed(2) : null; });
  charts.push(new Chart(document.getElementById('c2'), { type: 'line', data: { labels: days_.map(dshort), datasets: arms.map(([x, L, name], i) => ({ label: `${L} ${name}`, data: series(x.id), borderColor: i ? PINK : PURPLE, backgroundColor: i ? PINK : PURPLE, tension: .3, spanGaps: true, pointRadius: 3 })) },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (cc) => `${cc.dataset.label}: ${cc.parsed.y}%` } } }, scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => (+v).toFixed(2) + '%', maxTicksLimit: 5 } } } } }));
}

/* ---------- Shops vs online (Odoo) ---------- */
function pgOdoo(d, app) {
  const o = d.odoo;
  if (!o) { app.innerHTML = `<div class="wrap">${header('Shops vs online', '')}${nav()}${card('', empty('Odoo numbers arrive with the nightly job.'))}</div>`; return; }
  const S = o.channels.shops, O = o.channels.online, p1 = (x) => x.toFixed(1) + '%';
  const pair = (label, sv, ov, fmt, sub) => { const mx = Math.max(sv, ov) || 1, ch = sv ? (ov - sv) / sv * 100 : null;
    return `<div class="tile"><s-text tone="subdued">${label}</s-text><div class="pb"><span>Shops</span><div class="ftrack"><i style="width:${sv / mx * 100}%;background:${PURPLE}"></i></div><b>${fmt(sv)}</b></div><div class="pb"><span>Online</span><div class="ftrack"><i style="width:${ov / mx * 100}%;background:${PINK}"></i></div><b>${fmt(ov)}</b></div><div class="ts">${ch == null ? '' : `online ${chg(ch, 0)} vs shops · `}${sub}</div></div>`; };
  let h = header('Shops vs online', `Odoo orders ${esc(o.from)} – ${esc(o.to)} · ${num(S.orders)} shop orders vs ${num(O.orders)} online · updated ${tstamp(d.odoo_at)}`) + nav();
  h += '<div class="g4">' + pair('AOV', S.aov, O.aov, egp, 'incl. VAT') + pair('Items per order', S.upt, O.upt, (x) => x.toFixed(2), 'units') + pair('Orders with 2+ different items', S.multi2 / S.orders * 100, O.multi2 / O.orders * 100, p1, `${num(S.multi2)} of ${num(S.orders)} vs ${num(O.multi2)} of ${num(O.orders)}`) + pair('Orders with 5+ units', S.units5 / S.orders * 100, O.units5 / O.orders * 100, p1, `${num(S.units5)} of ${num(S.orders)} vs ${num(O.units5)} of ${num(O.orders)}`) + '</div>';
  const gaps = o.gaps || [], rate = (x, n) => `${n ? (100 * x / n).toFixed(0) : 0}% <span class="ts">${num(x)}/${num(n)}</span>`;
  const nm = (p) => p.handle ? `<a href="https://shop-ourkids.com/products/${encodeURIComponent(p.handle)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
  const live = (x) => x ? '<s-badge tone="success">In picks</s-badge>' : '<s-badge>Not yet</s-badge>';
  h += card('Bought together in shops, rarely online', gaps.length ? `<s-table><s-table-header-row><s-table-header>When they buy</s-table-header><s-table-header>…they also buy</s-table-header><s-table-header format="numeric">Shops</s-table-header><s-table-header format="numeric">Online</s-table-header><s-table-header format="numeric">Missed online baskets</s-table-header><s-table-header>Picks</s-table-header></s-table-header-row><s-table-body>${gaps.map((x) => `<s-table-row><s-table-cell>${nm(x.a)}</s-table-cell><s-table-cell>${nm(x.b)}</s-table-cell><s-table-cell>${rate(x.shops_x, x.shops_n)}</s-table-cell><s-table-cell>${rate(x.online_x, x.online_n)}</s-table-cell><s-table-cell>${num(x.missed)}</s-table-cell><s-table-cell>${live(x.live)}</s-table-cell></s-table-row>`).join('')}</s-table-body></s-table>` : empty('No gaps found.'), '<s-text tone="subdued">sorted by missed baskets</s-text>');
  const CT = ['Clothing', 'Toys', 'Baby Essentials', 'School', 'Party'], cx = o.category, sh = (c) => c === 'Baby Essentials' ? 'Baby' : c;
  const heat = (x, n) => { const r = n ? x / n : 0; return `style="background:rgba(143,126,240,${Math.min(0.6, r * 1.8).toFixed(2)})"`; };
  const matrix = (lab, m) => card(`${lab}: orders with… that also have…`, `<table class="mx"><tr><th></th>${CT.map((c) => `<th>${sh(c)}</th>`).join('')}</tr>${CT.map((a) => `<tr><td><b>${sh(a)}</b> <span class="ts">${num(m[a].n)}</span></td>${CT.map((b) => a === b ? '<td class="muted">–</td>' : `<td ${heat(m[a][b], m[a].n)}>${m[a].n ? (100 * m[a][b] / m[a].n).toFixed(1) : 0}%</td>`).join('')}</tr>`).join('')}</table>`);
  h += `<div class="g2">${matrix('Shops', cx.shops)}${matrix('Online', cx.online)}</div>`;
  const tp = o.pairs_top || [], top = (a) => `<s-table><s-table-header-row><s-table-header>Product</s-table-header><s-table-header format="numeric">Orders</s-table-header></s-table-header-row><s-table-body>${a.slice(0, 10).map((x) => `<s-table-row><s-table-cell>${nm(x)}</s-table-cell><s-table-cell>${num(x.orders)} <span class="ts">${(100 * x.orders / x.of).toFixed(1)}%</span></s-table-cell></s-table-row>`).join('')}</s-table-body></s-table>`;
  h += `<div class="g2">${card('Most bought together', `<s-table><s-table-header-row><s-table-header>Pair</s-table-header><s-table-header format="numeric">Orders together</s-table-header><s-table-header format="numeric">× more likely</s-table-header><s-table-header>Picks</s-table-header></s-table-header-row><s-table-body>${tp.map((x) => `<s-table-row><s-table-cell>${nm(x.a)} + ${nm(x.b)}</s-table-cell><s-table-cell>${num(x.together)}</s-table-cell><s-table-cell>${x.lift}×</s-table-cell><s-table-cell>${live(x.live)}</s-table-cell></s-table-row>`).join('')}</s-table-body></s-table>`, '<s-text tone="subdued">shops + online</s-text>')}${card('Most frequent purchases', `<div class="sub">Shops</div>${top(o.top_products.shops)}<div class="sub mt">Online</div>${top(o.top_products.online)}`, '<s-text tone="subdued">share of orders</s-text>')}</div>`;
  h += how('Straight from Odoo, refreshed nightly. Missed online baskets = how many more online orders would have had both items if online matched the shops’ rate: a what-if from measured rates, not a forecast. Pairs need 8+ shared orders and 20+ orders with the first item in each channel. × more likely = how much more often the second item is in an order with the first than in orders overall.');
  app.innerHTML = `<div class="wrap">${h}</div>`;
}

/* ---------- exports (restored: the live page lost them in an earlier edit) ---------- */
function csv(name, head, rows) {
  const q = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const blob = new Blob(['﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportAB() {
  const A = last?.sh?.A; if (!A) return; const sesBy = Object.fromEntries(last.sh.ses.map((r) => [String(r.rollout_treatment_id), r]));
  const lab = (id) => A.groups[id]?.label || id, tag = `${A.start}_${A.until}`;
  csv(`cross-sell-ab-orders_${tag}.csv`, ['order', 'group', 'order_value_egp', 'units', 'categories'], (A.orders || []).map((o) => [o[0], lab(o[1]), o[2], o[3], o[4]]));
  setTimeout(() => csv(`cross-sell-ab-metrics_${tag}.csv`, ['group', 'metric', 'value'], Object.entries(A.groups).flatMap(([id, g]) => { const r = sesBy[id] || {};
    const x = { ...g, sessions: +r.sessions || 0, atc: +r.sessions_with_cart_additions || 0, co: +r.sessions_that_reached_checkout || 0, conv: +r.sessions_that_completed_checkout || 0 };
    return [['sessions', x.sessions], ['added_to_cart', x.atc], ['reached_checkout', x.co], ['completed_checkout', x.conv], ['orders', x.orders], ['revenue_egp', x.rev], ['units', x.units], ['orders_2plus_categories', x.multi], ['clothing_orders', x.cloth], ['clothing_orders_with_toy', x.cloth_toy],
      ...Object.entries(x.mix || {}).map(([c, v]) => ['revenue_' + c.toLowerCase().replace(/\W+/g, '_'), v])].map(([m, v]) => [g.label, m, v]); })), 400);
}
function exportOnline() {
  const S = last?.sh; if (!S?.online?.jsonValue) return; const O = S.online.jsonValue, { lines } = xsAgg(S, O.start);
  csv(`cross-sell-by-day_${O.start}.csv`, ['day', 'placement', 'tiles_seen', 'clicks', 'adds', 'orders', 'units', 'revenue_egp'], O.rows.map((r) => [r.d, r.src, r.views, r.clicks, r.adds, r.orders, r.units, r.rev]));
  setTimeout(() => csv(`cross-sell-order-lines_${O.start}.csv`, ['order', 'time', 'order_total_egp', 'item', 'qty', 'item_value_egp', 'placement'], lines), 400);
}

/* first paint from the last visit while Shopify is read (no grey screen) */
try { const c = JSON.parse(sessionStorage.getItem('okb_last') || 'null'); if (c && !c.shErr) { last = c; show(c); } } catch (e) { /* no cache */ }
load();
