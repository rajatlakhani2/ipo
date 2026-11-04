/* Home — what needs you today, then money at a glance. Replaces the old Net Worth home. */
(function () {
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cr = n => {
        const v = Math.abs(Number(n || 0)), s = n < 0 ? '−' : '';
        if (v >= 1e7) return `${s}₹${(v / 1e7).toFixed(2)} Cr`;
        if (v >= 1e5) return `${s}₹${(v / 1e5).toFixed(2)} L`;
        return `${s}₹${Math.round(v).toLocaleString('en-IN')}`;
    };
    const pct = x => x == null ? '—' : (x >= 10 || x === 0 ? Math.round(x) : x.toFixed(1)) + '%';
    const times = x => x == null ? '—' : (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).toString().replace(/\.?0+$/, '') + '×';
    const get = async url => { try { const r = await apiFetch(url); return r.ok ? r.json() : null; } catch (_) { return null; } };
    const nowIST = () => new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000);
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function greeting() {
        const h = nowIST().getHours();
        const part = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        let name = '';
        try { name = ((getSession() || {}).user || {}).full_name || ''; } catch (_) { /* no session */ }
        name = name.split(' ')[0];
        name = name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : '';
        return name ? `${part}, ${name}` : part;
    }

    function investorIssues(list) {
        return (list || []).filter(inv =>
            (inv.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(inv.pan)) ||
            (inv.demat_account && !/^(\d{16}|IN\d{14})$/.test(inv.demat_account)) ||
            /^ABCDE\d{4}F$/.test(inv.pan || '')).length;
    }

    function todayItems(centre, home, investors) {
        const items = [];
        const t = (home && home.treasury) || {};
        if (centre) {
            const today = centre.today;
            const all = [...centre.tabs.open, ...centre.tabs.upcoming, ...centre.tabs.past];
            centre.tabs.open.filter(c => c.next_date === today).forEach(c => items.push({
                when: '5 PM', urgent: true, view: 'ipo-centre',
                title: `Last day to apply: ${c.name}`,
                detail: c.applied_pans
                    ? `${c.applied_pans} of ${centre.active_investors} PANs applied. Make sure UPI mandates are accepted before 5 PM.`
                    : `None of your ${centre.active_investors} PANs have applied yet.`,
                action: 'Open IPO',
            }));
            centre.tabs.open.filter(c => c.timeline[0].date === today).forEach(c => items.push({
                when: 'Today', view: 'ipo-centre',
                title: `Bidding opens: ${c.name}`,
                detail: `${cr(c.lot_cost)} per lot${c.gmp_pct != null ? `, GMP ${c.gmp_pct > 0 ? '+' : ''}${c.gmp_pct}%` : ''}.`,
                action: 'See details',
            }));
            centre.tabs.past.filter(c => c.next_event === 'allotment' && c.next_date === today).forEach(c => items.push({
                when: 'Today', view: 'allotment',
                title: `Allotment day: ${c.name}`,
                detail: c.applied_pans ? `Check results for your ${c.applied_pans} applications.` : 'Results come out this evening.',
                action: 'Check allotment',
            }));
            all.filter(c => c.timeline.some(s => s.key === 'listing' && s.today)).forEach(c => items.push({
                when: '10 AM', view: 'portfolio',
                title: `Listing today: ${c.name}`,
                detail: c.applied_pans ? 'Decide whether to sell or hold the allotted shares.' : 'Shares start trading on the exchange.',
                action: 'View portfolio',
            }));
        }
        if (t.funding_deficit > 0) items.push({
            when: 'Money', view: 'allocation',
            title: `Short by ${cr(t.funding_deficit)} for upcoming IPOs`,
            detail: `Needed ${cr(t.funding_required)}, available ${cr(t.available_for_ipo)}.`,
            action: 'Plan funding',
        });
        const bad = investorIssues(investors);
        if (bad) items.push({
            when: 'Data', view: 'investor-master',
            title: `${bad} investor${bad > 1 ? 's need' : ' needs'} PAN or Demat ID fixed`,
            detail: 'Wrong details can get applications rejected.',
            action: 'Fix now',
        });
        return items;
    }

    function nextUp(centre) {
        if (!centre) return '';
        const n = centre.tabs.upcoming.find(c => c.next_date);
        return n ? `Next IPO: <strong>${esc(n.name)}</strong> opens ${new Date(n.next_date).getDate()} ${MONTHS[new Date(n.next_date).getMonth()].slice(0, 3)}.` : '';
    }

    function compositionBar(nw) {
        const parts = [
            ['Stocks', nw.stocks_holdings, 'var(--t-sky)'],
            ['IPO shares', nw.ipo_holdings, 'var(--sh-marigold)'],
            ['Cash', nw.cash, 'var(--t-gain)'],
        ];
        const known = parts.reduce((s, p) => s + (p[1] || 0), 0);
        const other = (nw.net_worth || 0) - known;
        if (other > 0) parts.push(['Other', other, 'var(--sh-mist)']);
        const total = parts.reduce((s, p) => s + Math.max(0, p[1] || 0), 0) || 1;
        return `
            <div class="hm-bar" role="img" aria-label="Net worth split">${parts.map(p =>
                `<span style="width:${Math.max(0, p[1] || 0) / total * 100}%;background:${p[2]}"></span>`).join('')}</div>
            <ul class="hm-legend">${parts.map(p =>
                `<li><i style="background:${p[2]}"></i><span>${p[0]}</span><b>${cr(p[1])}</b></li>`).join('')}</ul>`;
    }

    function openIpoRows(centre) {
        if (!centre || !centre.tabs.open.length) return '';
        return `
            <section class="hm-card hm-ipos">
                <header><h2>Open for bidding</h2><button class="hm-link" data-view="ipo-centre">IPO Centre</button></header>
                <ul>${centre.tabs.open.slice(0, 5).map(c => `
                    <li data-view="ipo-centre" tabindex="0">
                        <div class="hm-ipo-name"><b>${esc(c.name)}</b><span>${c.type}</span>${c.next_date === centre.today ? '<em>Closes today</em>' : ''}</div>
                        <div class="hm-ipo-num"><span>GMP</span><b class="${c.gmp > 0 ? 'up' : c.gmp < 0 ? 'down' : ''}">${c.gmp_pct != null ? (c.gmp_pct > 0 ? '+' : '') + c.gmp_pct + '%' : '—'}</b></div>
                        <div class="hm-ipo-num"><span>Subscribed</span><b>${times(c.subscription.total)}</b></div>
                        <div class="hm-ipo-num"><span>Your chance</span><b class="mine">${c.chance ? pct(c.chance.applied_any ?? c.chance.one_pan) : '—'}</b></div>
                    </li>`).join('')}</ul>
            </section>`;
    }

    async function loadHome() {
        const el = document.getElementById('content-area');
        const d = nowIST();
        el.innerHTML = `<div class="hm"><header class="hm-head"><div><h1>${esc(greeting())}</h1><p>${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}</p></div></header>
            <div class="hm-loading" aria-busy="true"><div></div><div></div><div></div></div></div>`;
        const [home, centre, investors] = await Promise.all([get('/api/fo/home'), get('/api/fo/ipo-centre'), get('/api/fo/investors')]);
        if (!document.querySelector('.hm')) return; // user navigated away
        if (!home && !centre) {
            el.innerHTML = `<div class="hm"><div class="hm-card hm-error"><p>Couldn’t load your dashboard. Check your connection.</p><button class="btn btn-primary" onclick="loadView('home')">Try again</button></div></div>`;
            return;
        }
        const nw = (home && home.net_worth) || {};
        const t = (home && home.treasury) || {};
        const m = (home && home.market_pulse) || {};
        const items = todayItems(centre, home, investors);
        const recs = (home && home.recommendations) || [];

        el.innerHTML = `
            <div class="hm">
                <header class="hm-head">
                    <div><h1>${esc(greeting())}</h1><p>${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}</p></div>
                </header>

                <div class="hm-top">
                    <section class="hm-card hm-today" aria-labelledby="hm-today-h">
                        <header><h2 id="hm-today-h">${items.length ? `Needs you today` : 'All clear today'}</h2>
                            ${items.length ? `<span class="hm-count">${items.length}</span>` : ''}</header>
                        ${items.length ? `<ol class="hm-list">${items.map(i => `
                            <li class="${i.urgent ? 'is-urgent' : ''}">
                                <span class="hm-when">${esc(i.when)}</span>
                                <div class="hm-what"><b>${esc(i.title)}</b><p>${esc(i.detail)}</p></div>
                                <button class="hm-go" data-view="${i.view}">${esc(i.action)}</button>
                            </li>`).join('')}</ol>`
                        : `<p class="hm-quiet">No IPO closes, allots or lists today. ${nextUp(centre)}</p>`}
                    </section>

                    <section class="hm-card hm-worth" aria-labelledby="hm-worth-h">
                        <h2 id="hm-worth-h">Family net worth</h2>
                        <p class="hm-big">${cr(nw.net_worth)}</p>
                        ${m.today_gain != null ? `<p class="hm-delta ${m.today_gain >= 0 ? 'up' : 'down'}">${m.today_gain >= 0 ? '+' : '−'}${cr(Math.abs(m.today_gain)).replace('−', '')} today</p>` : ''}
                        ${compositionBar(nw)}
                    </section>
                </div>

                <section class="hm-money" aria-label="Money for IPOs">
                    <button data-view="treasury"><span>Cash available</span><b>${cr(t.cash)}</b></button>
                    <button data-view="treasury"><span>Blocked in ASBA</span><b>${cr(t.blocked)}</b></button>
                    <button data-view="treasury"><span>Refunds due</span><b>${cr(t.refunds)}</b></button>
                    <button data-view="allocation"><span>${t.funding_deficit > 0 ? 'Funding gap' : 'Funding'}</span>
                        <b class="${t.funding_deficit > 0 ? 'down' : 'up'}">${t.funding_deficit > 0 ? cr(t.funding_deficit) : 'Covered'}</b>
                        <i class="hm-meter"><i style="width:${Math.min(100, t.funding_required ? (t.available_for_ipo / t.funding_required * 100) : 100)}%"></i></i></button>
                </section>

                ${openIpoRows(centre)}

                <div class="hm-grid">
                    ${recs.length ? `
                    <section class="hm-card">
                        <header><h2>Suggestions</h2><button class="hm-link" data-view="advisor">AI Advisor</button></header>
                        <ul class="hm-recs">${recs.slice(0, 4).map(r => `<li class="${esc(r.priority)}"><b>${esc(r.title)}</b>${r.body ? `<p>${esc(r.body)}</p>` : ''}</li>`).join('')}</ul>
                    </section>` : ''}
                    ${(t.bank_strip || []).length ? `
                    <section class="hm-card">
                        <header><h2>Banks</h2><button class="hm-link" data-view="bank-master">Manage</button></header>
                        <ul class="hm-banks">${t.bank_strip.map(b => {
                            const used = b.balance ? (b.blocked || 0) / b.balance * 100 : 0;
                            return `<li><div><b>${esc(b.bank_name)}</b><span>${cr(b.available)} free of ${cr(b.balance)}</span></div>
                                <i class="hm-meter is-blocked" title="${Math.round(used)}% blocked"><i style="width:${used}%"></i></i></li>`;
                        }).join('')}</ul>
                    </section>` : ''}
                </div>
            </div>`;
    }

    document.addEventListener('click', e => {
        const t = e.target.closest('.hm [data-view]');
        if (t) { e.preventDefault(); window.loadView(t.dataset.view); }
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.hm li[data-view]')) { e.preventDefault(); window.loadView(e.target.dataset.view); }
    });

    window.loadHomeViewNew = loadHome;
    document.addEventListener('DOMContentLoaded', () => {
        const prev = window.loadView;
        window.loadView = function (view) {
            if (view === 'home' || view === 'command-board') return loadHome();
            return prev ? prev(view) : undefined;
        };
    });
})();
