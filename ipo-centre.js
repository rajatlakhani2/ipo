/* IPO Centre — Open now / Upcoming / Past, with GMP, subscription and family allotment chance. */
(function () {
    const API = '/api/fo/ipo-centre';
    const state = { data: null, tab: 'open', type: 'all', q: '', loading: false, refreshing: false, openId: null };
    let tickTimer = null;

    // ---------- formatting ----------
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const inr = n => n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: n < 100 ? 2 : 0 });
    const inrShort = n => {
        if (n == null) return '—';
        const v = Math.abs(n), s = n < 0 ? '−' : '';
        if (v >= 1e7) return `${s}₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
        if (v >= 1e5) return `${s}₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
        return s + '₹' + Math.round(v).toLocaleString('en-IN');
    };
    const signed = (n, suffix = '') => n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-IN')}${suffix}`;
    const signedInr = n => n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN')}`;
    const times = x => x == null ? '—' : (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).toString().replace(/\.?0+$/, '') + '×';
    const pct = x => x == null ? '—' : (x >= 10 || x === 0 ? Math.round(x) : x.toFixed(1)) + '%';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parseD = iso => { if (!iso) return null; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
    const dShort = iso => { const d = parseD(iso); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—'; };
    const todayIST = () => { const n = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
    const daysFrom = iso => { const d = parseD(iso); return d ? Math.round((d - todayIST()) / 864e5) : null; };
    const relDay = iso => {
        const n = daysFrom(iso);
        if (n == null) return 'date not announced';
        if (n === 0) return 'today';
        if (n === 1) return 'tomorrow';
        if (n === -1) return 'yesterday';
        if (n > 1 && n < 7) return `on ${WEEKDAYS[parseD(iso).getDay()]}`;
        return n > 0 ? `in ${n} days` : `${-n} days ago`;
    };
    const ago = iso => {
        if (!iso) return 'never';
        const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m} min ago`;
        const h = Math.round(m / 60);
        return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
    };
    // Bidding closes 5:00 PM IST on the last day (UPI mandates must be accepted by then)
    function closeCountdown(iso) {
        if (!iso) return null;
        const close = new Date(iso + 'T17:00:00+05:30').getTime();
        const ms = close - Date.now();
        if (ms <= 0) return { text: 'Bidding closed', urgent: true };
        const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        if (h < 24) return { text: `Closes in ${h ? h + 'h ' : ''}${m}m`, urgent: h < 6 };
        return { text: `Closes ${relDay(iso)}, 5 PM`, urgent: false };
    }

    // ---------- data ----------
    async function load(force) {
        state.loading = !state.data;
        if (!state.data) renderBody();
        try {
            const res = await apiFetch(API);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            state.data = await res.json();
            if (!force && state.data.counts.open === 0 && state.tab === 'open' && state.data.counts.upcoming) state.tab = 'open';
        } catch (e) {
            state.error = 'Couldn’t load IPOs. Check your connection and try again.';
        }
        state.loading = false;
        render();
        // If the server started a background refresh, pick up the fresh data shortly
        if (state.data && state.data.syncing && !force) setTimeout(() => isActive() && load(true), 45000);
    }

    async function refresh() {
        if (state.refreshing) return;
        state.refreshing = true; renderHeader();
        try {
            const res = await apiFetch(API + '/refresh', { method: 'POST', body: {} });
            const j = await res.json().catch(() => ({}));
            if (res.status === 409) { toast(j.message || 'Already refreshing', 'info'); }
            else if (!res.ok) { toast(j.error || 'Refresh failed', 'error'); }
            else {
                state.data = j;
                const s = j.sync || {};
                if (!s.fetched && s.errors && s.errors.length) {
                    toast(`Couldn’t reach the IPO sources (${s.errors.length} problems). First: ${s.errors[0]}`, 'error');
                } else {
                    toast(`Updated ${s.fetched ?? ''} IPOs${s.gmp_found != null ? `, GMP for ${s.gmp_found}` : ''}`, 'success');
                }
            }
        } catch (e) { toast('Refresh failed — check your connection', 'error'); }
        state.refreshing = false;
        render();
    }

    const toast = (m, t) => (typeof showToast === 'function' ? showToast(m, t) : console.log(m));
    const isActive = () => !!document.getElementById('ipc-root');

    // ---------- pieces ----------
    function filtered(list) {
        const q = state.q.trim().toLowerCase();
        return list.filter(c => (state.type === 'all' || c.type === state.type) && (!q || c.name.toLowerCase().includes(q)));
    }

    function typeTag(c) {
        return `<span class="ipc-tag ${c.type === 'SME' ? 'is-sme' : ''}">${esc(c.type)}</span>`;
    }

    function rail(c) {
        const steps = c.timeline;
        // progress: index of last step reached
        let reached = -1;
        steps.forEach((s, i) => { if (s.done || s.today) reached = i; });
        const fill = reached < 0 ? 0 : reached >= steps.length - 1 ? 100 : (reached / (steps.length - 1)) * 100 + 100 / (steps.length - 1) / 2;
        return `
            <div class="ipc-rail" role="list" aria-label="IPO timeline">
                <div class="ipc-rail-track"><div class="ipc-rail-fill" style="width:${fill}%"></div></div>
                ${steps.map((s, i) => `
                    <div class="ipc-rail-step ${s.done ? 'is-done' : ''} ${s.today ? 'is-today' : ''}" role="listitem" style="--i:${i}">
                        <span class="ipc-rail-dot"></span>
                        <span class="ipc-rail-label">${s.label}</span>
                        <span class="ipc-rail-date">${s.date ? dShort(s.date) : 'TBA'}${s.estimated ? '<abbr title="Expected date — not yet confirmed by the exchange">*</abbr>' : ''}</span>
                    </div>`).join('')}
            </div>`;
    }

    function subBars(c, opts = {}) {
        const cats = c.subscription.categories.filter(x => x.key !== 'nii' || !c.subscription.categories.some(y => y.key === 'shni'));
        if (!cats.length) return '';
        const max = Math.max(...cats.map(x => x.times || 0), 2);
        const w = x => Math.max(2, Math.log10(1 + (x || 0)) / Math.log10(1 + max) * 100);
        const one = Math.log10(2) / Math.log10(1 + max) * 100;
        return `
            <div class="ipc-bars" style="--one:${one}%">
                ${cats.slice(0, opts.limit || 99).map(x => `
                    <div class="ipc-bar-row">
                        <span class="ipc-bar-label">${esc(x.label)}</span>
                        <span class="ipc-bar"><span class="ipc-bar-fill ${x.times >= 1 ? 'is-over' : ''}" style="width:${w(x.times)}%"></span><span class="ipc-bar-one" title="Fully subscribed (1×)"></span></span>
                        <span class="ipc-bar-val">${times(x.times)}</span>
                    </div>`).join('')}
            </div>`;
    }

    // Family members as dots: filled = PANs expected to get shares
    function panDots(n, p, maxDots = 12) {
        if (!n) return '';
        const shown = Math.min(n, maxDots);
        const expected = n * p;
        const filled = Math.min(shown, Math.round(expected * shown / n));
        return `<span class="ipc-dots" aria-hidden="true">${Array.from({ length: shown }, (_, i) =>
            `<i class="${i < filled ? 'on' : ''}"></i>`).join('')}${n > maxDots ? `<b>+${n - maxDots}</b>` : ''}</span>`;
    }

    function chanceBlock(c) {
        const ch = c.chance;
        if (!ch) {
            return `<div class="ipc-chance is-empty"><p>Your allotment chance appears once bids start coming in.</p></div>`;
        }
        const p = ch.one_pan / 100;
        const applied = ch.applied_pans;
        const n = applied || ch.all_active_pans;
        const any = applied ? ch.applied_any : ch.all_active_any;
        const exp = n ? n * p : 0;
        const expText = exp >= 0.5
            ? `About ${Math.round(exp)} of ${n} PAN${n > 1 ? 's' : ''} likely to get shares.`
            : `Most likely none of the ${n} get${n > 1 ? '' : 's'} shares; it's a lottery.`;
        return `
            <div class="ipc-chance">
                <div class="ipc-chance-head">
                    <span class="ipc-chance-num">${pct(ch.one_pan)}</span>
                    <span class="ipc-chance-cap">chance per PAN<br><small>${ch.basis === 'retail' ? 'retail lottery, 1 lot' : 'from total subscription'}</small></span>
                </div>
                ${n ? `
                <div class="ipc-chance-family">
                    ${panDots(n, p)}
                    <p>${applied ? `${applied} PAN${applied > 1 ? 's' : ''} applied` : `If all ${n} active PANs apply`}:
                       <strong>${pct(any)}</strong> chance at least one gets shares.
                       <span class="ipc-muted">${expText}</span></p>
                </div>` : `<p class="ipc-muted">Add investors to see your family's combined chance.</p>`}
            </div>`;
    }

    function gmpBlock(c, big) {
        if (c.gmp == null) {
            return `<div class="ipc-gmp is-na"><span class="ipc-k">GMP</span><span class="ipc-v">Not available</span></div>`;
        }
        const cls = c.gmp > 0 ? 'is-up' : c.gmp < 0 ? 'is-down' : '';
        return `
            <div class="ipc-gmp ${cls} ${big ? 'is-big' : ''}">
                <span class="ipc-k">GMP <small title="Grey market premium: unofficial, reported by IPO tracker sites">unofficial</small></span>
                <span class="ipc-v">${signedInr(c.gmp)} <em>${c.gmp_pct != null ? signed(c.gmp_pct, '%') : ''}</em></span>
                ${c.gmp_per_lot != null ? `<span class="ipc-sub">${c.gmp_per_lot >= 0 ? '+' : '−'}${inrShort(Math.abs(c.gmp_per_lot))} per lot</span>` : ''}
            </div>`;
    }

    function priceLine(c) {
        const band = c.price_low && c.price_high && c.price_low !== c.price_high
            ? `${inr(c.price_low)}–${c.price_high.toLocaleString('en-IN')}` : inr(c.price_high || c.price_low);
        return `
            <dl class="ipc-facts">
                <div><dt>Price</dt><dd>${band}</dd></div>
                <div><dt>Lot</dt><dd>${c.lot_size ? c.lot_size.toLocaleString('en-IN') + ' shares' : '—'}</dd></div>
                <div><dt>1 lot costs</dt><dd>${inrShort(c.lot_cost)}</dd></div>
                ${c.issue_size ? `<div class="ipc-hide-sm"><dt>Issue size</dt><dd>${esc(c.issue_size)}</dd></div>` : ''}
            </dl>`;
    }

    // ---------- tab renderers ----------
    function openCard(c) {
        const cd = closeCountdown(c.next_date);
        return `
            <article class="ipc-card" data-id="${c.id}" tabindex="0" aria-label="${esc(c.name)} details">
                <header class="ipc-card-head">
                    <h3>${esc(c.name)}</h3>
                    <div class="ipc-card-tags">${typeTag(c)}${c.applied_pans ? `<span class="ipc-tag is-mine">Applied ×${c.applied_pans}</span>` : ''}</div>
                </header>
                ${cd ? `<p class="ipc-countdown ${cd.urgent ? 'is-urgent' : ''}" data-close="${c.next_date}">${cd.text}</p>` : ''}
                ${priceLine(c)}
                ${rail(c)}
                <div class="ipc-card-split">
                    ${gmpBlock(c)}
                    <div class="ipc-subs">
                        <span class="ipc-k">Subscribed</span>
                        <span class="ipc-v">${times(c.subscription.total)}</span>
                        ${c.subscription.updated_at ? `<span class="ipc-sub">${ago(c.subscription.updated_at)}</span>` : ''}
                    </div>
                </div>
                ${subBars(c, { limit: 4 })}
                ${chanceBlock(c)}
            </article>`;
    }

    function weekBucket(iso) {
        const n = daysFrom(iso);
        if (n == null) return 'Dates not announced yet';
        const t = todayIST(), dow = (t.getDay() + 6) % 7; // Mon = 0
        if (n <= 6 - dow) return 'This week';
        if (n <= 13 - dow) return 'Next week';
        return 'Later';
    }

    function upcomingRow(c) {
        const d = parseD(c.next_date);
        return `
            <li class="ipc-row" data-id="${c.id}" tabindex="0">
                <div class="ipc-date ${d ? '' : 'is-tba'}">
                    ${d ? `<b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span>` : '<span>TBA</span>'}
                </div>
                <div class="ipc-row-main">
                    <h4>${esc(c.name)} ${typeTag(c)}</h4>
                    <p>${c.price_high ? priceLineShort(c) : 'Price band not announced'}</p>
                </div>
                <div class="ipc-row-side">
                    <span class="ipc-when">Opens ${relDay(c.next_date)}</span>
                    ${c.gmp != null ? `<span class="ipc-mini ${c.gmp > 0 ? 'is-up' : c.gmp < 0 ? 'is-down' : ''}">GMP ${signed(c.gmp_pct, '%')}</span>` : ''}
                </div>
            </li>`;
    }
    const priceLineShort = c => `${c.price_low && c.price_low !== c.price_high ? inr(c.price_low) + '–' + c.price_high.toLocaleString('en-IN') : inr(c.price_high)}${c.lot_cost ? `, ${inrShort(c.lot_cost)} per lot` : ''}`;

    function pastRow(c) {
        const gain = c.listing_gain_pct, now = c.gain_now_pct;
        const waiting = c.stage === 'closed';
        return `
            <li class="ipc-ledger-row" data-id="${c.id}" tabindex="0">
                <div class="ipc-ledger-name">
                    <h4>${esc(c.name)}</h4>
                    <span>${typeTag(c)} ${waiting
                        ? `${c.next_event === 'allotment' ? 'Allotment' : 'Listing'} ${relDay(c.next_date)}`
                        : `Listed ${dShort(c.timeline[3].date)}`}</span>
                </div>
                <div class="ipc-ledger-num"><span>Issue</span><b>${inr(c.price_high)}</b></div>
                ${waiting ? `
                    <div class="ipc-ledger-num"><span>Subscribed</span><b>${times(c.subscription.total)}</b></div>
                    <div class="ipc-ledger-num"><span>GMP</span><b class="${c.gmp > 0 ? 'is-up' : c.gmp < 0 ? 'is-down' : ''}">${c.gmp != null ? signed(c.gmp_pct, '%') : '—'}</b></div>`
                : `
                    <div class="ipc-ledger-num"><span>Listing gain</span><b class="${gain > 0 ? 'is-up' : gain < 0 ? 'is-down' : ''}">${gain != null ? signed(gain, '%') : '—'}</b></div>
                    <div class="ipc-ledger-num"><span>Now</span><b class="${now > 0 ? 'is-up' : now < 0 ? 'is-down' : ''}">${now != null ? signed(now, '%') : '—'}</b></div>`}
            </li>`;
    }

    function emptyState() {
        const d = state.data;
        if (state.q || state.type !== 'all') {
            return `<div class="ipc-empty"><p>No ${state.type === 'all' ? '' : state.type + ' '}IPOs match “${esc(state.q)}”.</p><button class="ipc-btn" data-act="clear">Clear filters</button></div>`;
        }
        if (state.tab === 'open') {
            const next = d.tabs.upcoming.find(c => c.next_date);
            return `<div class="ipc-empty"><p>No IPO is taking bids right now.</p>
                ${next ? `<p class="ipc-muted">Next up: <strong>${esc(next.name)}</strong> opens ${relDay(next.next_date)} (${dShort(next.next_date)}).</p>` : ''}
                ${d.counts.upcoming ? `<button class="ipc-btn" data-tab="upcoming">See upcoming IPOs</button>` : ''}</div>`;
        }
        if (state.tab === 'upcoming') return `<div class="ipc-empty"><p>No upcoming IPOs announced yet.</p><p class="ipc-muted">New issues usually appear here a week before they open.</p></div>`;
        return `<div class="ipc-empty"><p>No past IPOs to show yet.</p><p class="ipc-muted">Tap Refresh to fetch the last few months from NSE.</p></div>`;
    }

    // ---------- page ----------
    function renderHeader() {
        const el = document.getElementById('ipc-head');
        if (!el) return;
        const d = state.data;
        el.innerHTML = `
            <div class="ipc-title">
                <h1>IPO Centre</h1>
                <p class="ipc-muted">${d ? `Updated ${ago(d.last_synced_at)}${d.syncing ? ' — fetching newer data…' : ''}` : 'Live IPOs from NSE and IPO trackers'}</p>
            </div>
            <button class="ipc-btn ipc-refresh" data-act="refresh" ${state.refreshing ? 'disabled aria-busy="true"' : ''}>
                <i class="fas fa-sync-alt ${state.refreshing ? 'fa-spin' : ''}" aria-hidden="true"></i>
                <span>${state.refreshing ? 'Refreshing… up to a minute' : 'Refresh'}</span>
            </button>`;
    }

    function todayStrip() {
        const e = state.data.events_today;
        const items = [
            ...e.closing.map(n => ['Last day to apply', n, 'is-urgent']),
            ...e.opening.map(n => ['Opens today', n, '']),
            ...e.allotment.map(n => ['Allotment today', n, '']),
            ...e.listing.map(n => ['Lists today', n, '']),
        ];
        if (!items.length) return '';
        return `<ul class="ipc-today" aria-label="Today">${items.map(([k, n, cls]) =>
            `<li class="${cls}"><span>${k}</span> ${esc(n)}</li>`).join('')}</ul>`;
    }

    function renderBody() {
        const el = document.getElementById('ipc-body');
        if (!el) return;
        if (state.loading) {
            el.innerHTML = `<div class="ipc-skeleton" aria-busy="true" aria-label="Loading IPOs">${'<div></div>'.repeat(3)}</div>`;
            return;
        }
        if (!state.data) {
            el.innerHTML = `<div class="ipc-empty"><p>${esc(state.error || 'Something went wrong.')}</p><button class="ipc-btn" data-act="reload">Try again</button></div>`;
            return;
        }
        const d = state.data;
        const list = filtered(d.tabs[state.tab]);
        let html = '';
        if (!list.length) html = emptyState();
        else if (state.tab === 'open') html = `<div class="ipc-grid">${list.map(openCard).join('')}</div>`;
        else if (state.tab === 'upcoming') {
            const groups = {};
            list.forEach(c => (groups[weekBucket(c.next_date)] ||= []).push(c));
            html = ['This week', 'Next week', 'Later', 'Dates not announced yet'].filter(g => groups[g]).map(g =>
                `<section class="ipc-group"><h2>${g}</h2><ul class="ipc-rows">${groups[g].map(upcomingRow).join('')}</ul></section>`).join('');
        } else {
            const waiting = list.filter(c => c.stage === 'closed'), listed = list.filter(c => c.stage !== 'closed');
            html = (waiting.length ? `<section class="ipc-group"><h2>Waiting for allotment or listing</h2><ul class="ipc-ledger">${waiting.map(pastRow).join('')}</ul></section>` : '')
                 + (listed.length ? `<section class="ipc-group"><h2>Listed</h2><ul class="ipc-ledger">${listed.map(pastRow).join('')}</ul></section>` : '');
        }
        el.innerHTML = (state.tab === 'open' ? todayStrip() : '') + html;
    }

    function renderTabs() {
        const el = document.getElementById('ipc-tabs');
        if (!el) return;
        const c = state.data ? state.data.counts : {};
        const tabs = [['open', 'Open now'], ['upcoming', 'Upcoming'], ['past', 'Past']];
        el.innerHTML = `
            <div class="ipc-tablist" role="tablist" aria-label="IPO status">
                ${tabs.map(([k, l]) => `<button role="tab" aria-selected="${state.tab === k}" data-tab="${k}" class="${state.tab === k ? 'is-on' : ''}">
                    ${l}${c[k] != null ? `<span class="ipc-count">${c[k]}</span>` : ''}</button>`).join('')}
            </div>
            <div class="ipc-filters">
                <div class="ipc-seg" role="group" aria-label="IPO type">
                    ${['all', 'Mainboard', 'SME'].map(t => `<button data-type="${t}" aria-pressed="${state.type === t}" class="${state.type === t ? 'is-on' : ''}">${t === 'all' ? 'All' : t}</button>`).join('')}
                </div>
                <label class="ipc-search"><i class="fas fa-search" aria-hidden="true"></i>
                    <input type="search" id="ipc-q" placeholder="Search IPOs" value="${esc(state.q)}" aria-label="Search IPOs"></label>
            </div>`;
    }

    function render() {
        renderHeader(); renderTabs(); renderBody();
        if (state.openId) openDrawer(state.openId, true);
    }

    // ---------- detail drawer ----------
    function findCard(id) {
        if (!state.data) return null;
        for (const k of ['open', 'upcoming', 'past']) {
            const c = state.data.tabs[k].find(x => String(x.id) === String(id));
            if (c) return c;
        }
        return null;
    }

    function calculator(c) {
        const ch = c.chance;
        if (!ch) return '';
        const max = Math.max(20, ch.all_active_pans || 0);
        const start = ch.applied_pans || ch.all_active_pans || 1;
        return `
            <section class="ipc-calc">
                <h3>How many PANs should apply?</h3>
                <label class="ipc-calc-input">If <output id="ipc-n">${start}</output> PAN${start > 1 ? 's' : ''} apply
                    <input type="range" id="ipc-n-range" min="1" max="${max}" value="${start}" aria-label="Number of PANs">
                </label>
                <div class="ipc-calc-out" id="ipc-calc-out"></div>
                <p class="ipc-muted ipc-fine">You need about <strong>${ch.pans_for_50}</strong> PAN${ch.pans_for_50 > 1 ? 's' : ''} for an even chance and <strong>${ch.pans_for_90}</strong> for a 90% chance of at least one allotment.
                Based on ${ch.basis === 'retail' ? 'the live retail subscription' : 'total subscription'}; a lottery gives each 1-lot application the same chance.</p>
            </section>`;
    }

    function updateCalc(c, n) {
        const out = document.getElementById('ipc-calc-out');
        if (!out) return;
        const p = c.chance.one_pan / 100;
        const any = (1 - Math.pow(1 - p, n)) * 100;
        const exp = n * p;
        out.innerHTML = `
            <div><span>At least one allotted</span><b>${pct(any)}</b></div>
            <div><span>Expected allotments</span><b>${exp < 10 ? exp.toFixed(1) : Math.round(exp)}</b></div>
            <div><span>Money blocked</span><b>${inrShort(c.lot_cost ? c.lot_cost * n : null)}</b></div>
            <div><span>Expected gain</span><b class="${c.gmp > 0 ? 'is-up' : c.gmp < 0 ? 'is-down' : ''}">${c.gmp_per_lot != null ? inrShort(exp * c.gmp_per_lot) : '—'}</b></div>`;
        document.getElementById('ipc-n').textContent = n;
    }

    function openDrawer(id, silent) {
        const c = findCard(id);
        const wrap = document.getElementById('ipc-drawer');
        if (!c || !wrap) return;
        state.openId = id;
        const cats = c.subscription.categories;
        const byCat = (c.chance && c.chance.by_category) || {};
        wrap.innerHTML = `
            <div class="ipc-scrim" data-act="close"></div>
            <aside class="ipc-sheet" role="dialog" aria-modal="true" aria-labelledby="ipc-d-title">
                <header class="ipc-sheet-head">
                    <div><h2 id="ipc-d-title">${esc(c.name)}</h2><p class="ipc-muted">${typeTag(c)} ${esc(c.exchange || '')}${c.symbol ? ' ' + esc(c.symbol) : ''}</p></div>
                    <button class="ipc-icon-btn" data-act="close" aria-label="Close details"><i class="fas fa-times" aria-hidden="true"></i></button>
                </header>
                <div class="ipc-sheet-body">
                    ${priceLine(c)}
                    ${rail(c)}
                    ${gmpBlock(c, true)}
                    ${c.gmp_updated_at ? `<p class="ipc-muted ipc-fine">GMP from ${esc(c.gmp_source || 'tracker sites')}, ${ago(c.gmp_updated_at)}. Grey-market prices are informal and can change quickly.</p>` : ''}
                    ${cats.length ? `
                    <section>
                        <h3>Subscription by category</h3>
                        <table class="ipc-table">
                            <thead><tr><th scope="col">Category</th><th scope="col">Subscribed</th><th scope="col">Chance per 1 lot</th></tr></thead>
                            <tbody>${cats.map(x => `<tr><th scope="row">${esc(x.label)}</th><td>${times(x.times)}</td><td>${byCat[x.key] != null ? pct(byCat[x.key]) : '—'}</td></tr>`).join('')}
                            ${c.subscription.total != null ? `<tr class="is-total"><th scope="row">Total</th><td>${times(c.subscription.total)}</td><td></td></tr>` : ''}</tbody>
                        </table>
                        ${c.subscription.updated_at ? `<p class="ipc-muted ipc-fine">From NSE, ${ago(c.subscription.updated_at)}.</p>` : ''}
                    </section>` : ''}
                    ${c.stage === 'open' || c.stage === 'closed' ? chanceBlock(c) : ''}
                    ${calculator(c)}
                    ${c.listing_price || c.current_price ? `
                    <section><h3>After listing</h3>
                        <dl class="ipc-facts">
                            <div><dt>Listing price</dt><dd>${inr(c.listing_price)} <small class="${c.listing_gain_pct > 0 ? 'is-up' : 'is-down'}">${c.listing_gain_pct != null ? signed(c.listing_gain_pct, '%') : ''}</small></dd></div>
                            <div><dt>Price now</dt><dd>${inr(c.current_price)} <small class="${c.gain_now_pct > 0 ? 'is-up' : 'is-down'}">${c.gain_now_pct != null ? signed(c.gain_now_pct, '%') : ''}</small></dd></div>
                        </dl></section>` : ''}
                    ${c.registrar ? `<p class="ipc-muted">Registrar: ${esc(c.registrar)}</p>` : ''}
                    <div class="ipc-sheet-actions">
                        <button class="ipc-btn is-primary" data-act="import" data-id="${c.id}">Add to my IPOs</button>
                        ${c.source_url ? `<a class="ipc-btn" href="${esc(c.source_url)}" target="_blank" rel="noopener">View on NSE</a>` : ''}
                    </div>
                </div>
            </aside>`;
        wrap.classList.add('is-open');
        document.body.classList.add('ipc-lock');
        if (c.chance) {
            const r = document.getElementById('ipc-n-range');
            updateCalc(c, +r.value);
            r.addEventListener('input', () => updateCalc(c, +r.value));
        }
        if (!silent) wrap.querySelector('.ipc-icon-btn').focus();
    }

    function closeDrawer() {
        const wrap = document.getElementById('ipc-drawer');
        state.openId = null;
        if (wrap) { wrap.classList.remove('is-open'); wrap.innerHTML = ''; }
        document.body.classList.remove('ipc-lock');
    }

    async function importIpo(id) {
        try {
            const res = await apiFetch(`/api/upcoming-ipos/${id}/import`, { method: 'POST', body: {} });
            const j = await res.json().catch(() => ({}));
            toast(res.ok ? 'Added to your IPOs' : (j.error || 'Couldn’t add this IPO'), res.ok ? 'success' : 'error');
        } catch (e) { toast('Couldn’t add this IPO', 'error'); }
    }

    // ---------- events ----------
    function bind(root) {
        root.addEventListener('click', e => {
            const t = e.target.closest('[data-tab],[data-type],[data-act],[data-id]');
            if (!t) return;
            if (t.dataset.tab) { state.tab = t.dataset.tab; renderTabs(); renderBody(); window.scrollTo({ top: 0 }); return; }
            if (t.dataset.type) { state.type = t.dataset.type; renderTabs(); renderBody(); return; }
            const act = t.dataset.act;
            if (act === 'refresh') return refresh();
            if (act === 'reload') return load();
            if (act === 'clear') { state.q = ''; state.type = 'all'; renderTabs(); renderBody(); return; }
            if (act === 'close') return closeDrawer();
            if (act === 'import') return importIpo(t.dataset.id);
            if (t.dataset.id && !act) openDrawer(t.dataset.id);
        });
        root.addEventListener('keydown', e => {
            if (e.key === 'Escape') return closeDrawer();
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id][tabindex]')) { e.preventDefault(); openDrawer(e.target.dataset.id); }
            // arrow keys move between tabs
            if (e.target.closest('[role="tablist"]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                const order = ['open', 'upcoming', 'past'];
                state.tab = order[(order.indexOf(state.tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
                renderTabs(); renderBody();
                root.querySelector(`[data-tab="${state.tab}"]`).focus();
            }
        });
        root.addEventListener('input', e => {
            if (e.target.id === 'ipc-q') { state.q = e.target.value; renderBody(); }
        });
    }

    function tick() {
        if (!isActive()) { clearInterval(tickTimer); tickTimer = null; closeDrawer(); return; }
        document.querySelectorAll('.ipc-countdown[data-close]').forEach(el => {
            const cd = closeCountdown(el.dataset.close);
            if (cd) { el.textContent = cd.text; el.classList.toggle('is-urgent', cd.urgent); }
        });
    }

    async function loadIPOCentreView() {
        const area = document.getElementById('content-area');
        closeDrawer();
        area.innerHTML = `
            <div id="ipc-root" class="ipc">
                <div id="ipc-head" class="ipc-head"></div>
                <div id="ipc-tabs" class="ipc-tabs"></div>
                <div id="ipc-body" class="ipc-body" aria-live="polite"></div>
            </div>`;
        bind(document.getElementById('ipc-root'));
        // The detail sheet lives on <body> so it can sit above the app's own layers (tab bar, header)
        if (!document.getElementById('ipc-drawer')) {
            const d = document.createElement('div');
            d.id = 'ipc-drawer';
            d.className = 'ipc ipc-drawer';
            document.body.appendChild(d);
            bind(d);
        }
        render();
        if (!tickTimer) tickTimer = setInterval(tick, 30000);
        await load();
    }
    window.loadIPOCentreView = loadIPOCentreView;

    // Route 'ipo-centre' (and the old 'upcoming' feed) to this view
    document.addEventListener('DOMContentLoaded', () => {
        const prev = window.loadView;
        window.loadView = function (view) {
            if (view === 'ipo-centre' || view === 'upcoming') return loadIPOCentreView();
            closeDrawer();
            return prev ? prev(view) : undefined;
        };
    });
})();
