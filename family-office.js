/**
 * Family Office Dashboard — Premium UI (all phases)
 */
(function () {
    const FO = '/api/fo';
    let marketRefreshTimer = null;

    if (typeof requireAuth === 'function' && !requireAuth()) return;

    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('fo-premium', 'dark-mode');
        patchNavigation();
        patchLoadView();
        startLiveRefresh();
        startLiveClock();
        loadFONotifications();
        setInterval(loadFONotifications, 60000);
        initOrgSwitcher();
        handleBrokerCallback();
        setTimeout(() => {
            if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
                const active = document.querySelector('.sidebar nav li.active');
                if (!active || active.dataset.view === 'command-board') {
                    document.querySelectorAll('.sidebar nav li').forEach(n => n.classList.remove('active'));
                    const home = document.querySelector('[data-view="home"]');
                    if (home) { home.classList.add('active'); loadView('home'); }
                }
            }
        }, 150);
    });

    function patchNavigation() {
        document.querySelectorAll('.sidebar nav li').forEach(li => {
            li.addEventListener('click', () => {
                document.querySelectorAll('.sidebar nav li').forEach(n => n.classList.remove('active'));
                li.classList.add('active');
            });
        });
    }

    function patchLoadView() {
        const orig = window.loadView;
        const routes = {
            home: loadHomeView,
            treasury: loadTreasuryView,
            'investor-master': loadInvestorMasterView,
            'bank-master': loadBankMasterView,
            'ipo-master': loadIPOMasterView,
            allocation: loadAllocationView,
            kanban: loadKanbanView,
            transfers: loadTransfersView,
            allotment: loadAllotmentView,
            portfolio: loadPortfolioView,
            wealth: loadWealthView,
            advisor: loadAdvisorView,
            'command-board': loadHomeView,
        };
        window.loadView = function (view) {
            if (routes[view]) return routes[view]();
            return orig(view);
        };
        window.loadView = window.loadView;
    }

    function startLiveRefresh() {
        if (marketRefreshTimer) clearInterval(marketRefreshTimer);
        marketRefreshTimer = setInterval(async () => {
            try {
                await apiFetch(`${FO}/market/refresh`, { method: 'POST', body: {} });
                const active = document.querySelector('.sidebar nav li.active');
                if (active?.dataset.view === 'home') loadHomeView();
            } catch (e) { /* silent */ }
        }, 5 * 60 * 1000);
    }

    function startLiveClock() {
        const el = document.getElementById('fo-live-clock');
        if (!el) return;
        const tick = () => {
            const now = new Date();
            el.innerHTML = `<span class="live-dot" style="display:inline-block;width:6px;height:6px;background:var(--fo-emerald);border-radius:50%;margin-right:6px;animation:fo-pulse 2s infinite"></span>${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} LIVE`;
        };
        tick();
        setInterval(tick, 1000);
    }

    window.toggleFONotifications = function () {
        const panel = document.getElementById('fo-notif-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) loadFONotifications(true);
    };

    async function loadFONotifications(renderPanel) {
        try {
            const data = await foFetch('/notifications');
            const badge = document.getElementById('fo-notif-badge');
            if (badge) {
                if (data.count > 0) {
                    badge.style.display = 'inline';
                    badge.textContent = data.count;
                } else badge.style.display = 'none';
            }
            if (renderPanel) {
                const panel = document.getElementById('fo-notif-panel');
                if (panel) {
                    panel.innerHTML = (data.alerts || []).map(a => `
                        <div class="fo-notif-item ${a.priority}" onclick="loadView('${a.action_view}');document.getElementById('fo-notif-panel').classList.add('hidden')">
                            <strong style="color:var(--fo-heading);font-size:0.85rem">${a.title}</strong>
                            <div style="font-size:0.75rem;color:var(--fo-text);margin-top:0.25rem">${a.body}</div>
                        </div>
                    `).join('') || '<p style="opacity:0.7;font-size:0.85rem">No alerts right now</p>';
                }
            }
        } catch (e) { /* silent */ }
    }

    function fmt(n) {
        if (typeof formatCurrency === 'function') return formatCurrency(n);
        return '₹' + Number(n || 0).toLocaleString('en-IN');
    }

    function fmtCr(n) {
        const v = Number(n || 0);
        if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
        if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
        return fmt(v);
    }

    async function foFetch(path, opts) {
        const res = await apiFetch(`${FO}${path}`, opts || {});
        return res.json();
    }

    // ========== HOME ==========
    async function initOrgSwitcher() {
        try {
            const me = await apiFetch(`${API_BASE}/auth/me`).then(r => r.json());
            const orgs = me.organizations || [];
            const sel = document.getElementById('fo-org-switcher');
            const badge = document.getElementById('org-display-name');
            if (!sel || orgs.length < 2) return;
            sel.style.display = 'inline-block';
            if (badge) badge.style.display = 'none';
            sel.innerHTML = orgs.map(o => `<option value="${o.id}" ${o.id === me.organization?.id ? 'selected' : ''}>${o.name}</option>`).join('');
            sel.onchange = async () => {
                const res = await apiFetch(`${API_BASE}/auth/switch-org`, { method: 'POST', body: { organization_id: parseInt(sel.value) } });
                const data = await res.json();
                if (res.ok) {
                    const s = getSession();
                    saveSession({ ...data, user: s?.user, organizations: orgs });
                    updateUserProfileUI();
                    showToast(`Switched to ${data.organization.name}`, 'success');
                    loadHomeView();
                }
            };
        } catch (e) { /* single org */ }
    }

    window.foFetchLiveAndHome = async function () {
        showToast('Syncing live IPOs...', 'info');
        await apiFetch('/api/upcoming-ipos/fetch-live', { method: 'POST', body: {} });
        showToast('Live IPOs updated', 'success');
        loadHomeView();
    };

    window.refreshAllGMP = async function () {
        showToast('Fetching live GMP...', 'info');
        const res = await apiFetch(`${FO}/ipos/refresh-gmp`, { method: 'POST', body: {} });
        const data = await res.json();
        showToast(data.message || 'Done', 'success');
        loadIPOMasterView();
    };

    window.exportFOReport = async function () {
        const res = await apiFetch(`${FO}/reports/export`);
        if (!res.ok) { showToast('Export failed', 'error'); return; }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'family_office_report.xlsx';
        a.click();
        showToast('Report downloaded', 'success');
    };

    async function loadHomeView() {
        const el = document.getElementById('content-area');
        el.innerHTML = '<div class="fo-panel"><i class="fas fa-spinner fa-spin"></i> Loading family dashboard...</div>';
        try {
            let [data, closing, quick] = await Promise.all([
                foFetch('/home'), foFetch('/closing-ipos'), foFetch('/quick-actions'),
            ]);
            if (!data.treasury?.bank_strip?.length) {
                await apiFetch(`${FO}/seed-demo`, { method: 'POST', body: {} });
                data = await foFetch('/home');
            }
            const nw = data.net_worth || {};
            const t = data.treasury || {};
            const m = data.market_pulse || {};
            const recs = data.recommendations || [];

            el.innerHTML = `
                <div class="fo-hero">
                    <div class="fo-hero-label"><span class="live-dot"></span> Family Net Worth · Live</div>
                    <div class="fo-hero-value"><span class="currency">₹</span>${fmtCr(nw.net_worth).replace('₹', '')}</div>
                    <div class="fo-hero-sub">
                        Stocks ${fmtCr(nw.stocks_holdings)} · IPO ${fmtCr(nw.ipo_holdings)} · Cash ${fmtCr(nw.cash)}
                        ${m.last_updated ? ` · Market updated ${new Date(m.last_updated).toLocaleTimeString()}` : ''}
                    </div>
                </div>

                <div class="fo-metrics">
                    <div class="fo-metric" onclick="loadView('treasury')">
                        <div class="fo-metric-icon cash"><i class="fas fa-wallet"></i></div>
                        <div class="fo-metric-value">${fmtCr(t.cash)}</div>
                        <div class="fo-metric-label">Cash Available</div>
                    </div>
                    <div class="fo-metric" onclick="loadView('treasury')">
                        <div class="fo-metric-icon blocked"><i class="fas fa-lock"></i></div>
                        <div class="fo-metric-value">${fmtCr(t.blocked)}</div>
                        <div class="fo-metric-label">ASBA Blocked</div>
                    </div>
                    <div class="fo-metric" onclick="loadView('treasury')">
                        <div class="fo-metric-icon refund"><i class="fas fa-undo"></i></div>
                        <div class="fo-metric-value">${fmtCr(t.refunds)}</div>
                        <div class="fo-metric-label">Expected Refunds</div>
                    </div>
                    <div class="fo-metric" onclick="loadView('portfolio')">
                        <div class="fo-metric-icon gain"><i class="fas fa-chart-line"></i></div>
                        <div class="fo-metric-value" style="color:var(--fo-emerald)">${fmt(m.today_gain)}</div>
                        <div class="fo-metric-label">Today's Gain</div>
                    </div>
                </div>

                ${(quick.actions || []).length ? `
                <div class="fo-panel" style="margin-bottom:1.5rem">
                    <div class="fo-panel-title"><i class="fas fa-bolt"></i> Quick Actions</div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        ${quick.actions.map(a => `
                            <button class="btn btn-primary" onclick="loadView('${a.view}')">${a.title}</button>
                        `).join('')}
                        <button class="btn btn-secondary" onclick="foFetchLiveAndHome()"><i class="fas fa-sync"></i> Sync Live IPOs</button>
                    </div>
                </div>` : ''}

                <div class="fo-grid-2">
                    <div class="fo-panel">
                        <div class="fo-panel-title"><i class="fas fa-robot"></i> AI Recommendations</div>
                        ${recs.length ? recs.map(r => `
                            <div class="fo-rec-item ${r.priority}" onclick="loadView('advisor')">
                                <div class="fo-rec-title">${r.title}</div>
                                <div class="fo-rec-body">${r.body || ''}</div>
                            </div>
                        `).join('') : '<p style="opacity:0.7">No recommendations yet.</p>'}
                    </div>
                    <div class="fo-panel">
                        <div class="fo-panel-title"><i class="fas fa-coins"></i> Upcoming IPO Funding</div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                            <span>Required</span><strong>${fmtCr(t.funding_required)}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
                            <span>Available</span><strong style="color:var(--fo-emerald)">${fmtCr(t.available_for_ipo)}</strong>
                        </div>
                        ${t.funding_deficit > 0 ? `<div class="fo-funding-deficit">Deficit: ${fmtCr(t.funding_deficit)}</div>` : '<div style="color:var(--fo-emerald)">✓ Fully funded</div>'}
                        <div class="fo-funding-bar"><div class="fo-funding-fill" style="width:${Math.min(100, t.funding_required ? (t.available_for_ipo / t.funding_required * 100) : 100)}%"></div></div>
                        <button class="btn btn-primary" style="margin-top:1rem;width:100%" onclick="loadView('allocation')"><i class="fas fa-magic"></i> Optimize Allocation</button>
                    </div>
                </div>

                <div class="fo-panel">
                    <div class="fo-panel-title"><i class="fas fa-university"></i> Live Treasury</div>
                    <div class="fo-treasury-strip">
                        ${(t.bank_strip || []).map(b => `
                            <div class="fo-bank-chip" onclick="loadView('bank-master')">
                                <div class="name">${b.bank_name}</div>
                                <div class="bal">${fmtCr(b.balance)}</div>
                                <div class="sub">Blocked ${fmtCr(b.blocked)} · Avail ${fmtCr(b.available)}</div>
                            </div>
                        `).join('') || '<p>Add bank accounts in Bank Master</p>'}
                    </div>
                </div>

                ${(closing || []).length ? `
                <div class="fo-panel" style="margin-top:1.5rem">
                    <div class="fo-panel-title"><i class="fas fa-hourglass-half"></i> Closing Soon</div>
                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
                        ${closing.map(c => `
                            <div class="fo-bank-chip" style="min-width:180px;border-left:3px solid ${c.urgency==='critical'?'var(--fo-rose)':c.urgency==='high'?'var(--fo-gold)':'var(--fo-cyan)'}" onclick="loadView('allocation')">
                                <div class="name">${c.ipo_name}</div>
                                <div class="bal" style="font-size:1rem">${c.days_left === 0 ? 'TODAY' : c.days_left + 'd left'}</div>
                                <div class="sub">Score ${c.ipo_score || '—'} · GMP ${c.gmp ? fmt(c.gmp) : '—'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem">
                    <button class="btn btn-secondary" onclick="loadView('kanban')"><i class="fas fa-columns"></i> Kanban</button>
                    <button class="btn btn-secondary" onclick="loadView('applications')"><i class="fas fa-table"></i> IPO-wise</button>
                    <button class="btn btn-secondary" onclick="loadView('upcoming')"><i class="fas fa-rss"></i> Live IPO Feed</button>
                    <button class="btn btn-secondary" onclick="loadView('allotment')"><i class="fas fa-trophy"></i> Allotment Center</button>
                    <button class="btn btn-secondary" onclick="exportFOReport()"><i class="fas fa-file-excel"></i> Export Report</button>
                </div>
            `;
        } catch (e) {
            el.innerHTML = `<div class="fo-panel">Error loading dashboard. <button class="btn btn-primary" onclick="loadView('home')">Retry</button></div>`;
        }
    }

    // ========== TREASURY ==========
    async function loadTreasuryView() {
        const el = document.getElementById('content-area');
        el.innerHTML = '<div class="fo-panel">Loading treasury...</div>';
        const data = await foFetch('/treasury');
        const s = data.settlement || {};
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-landmark"></i> Treasury Control</h1>
                <button class="btn btn-primary" onclick="loadView('bank-master')"><i class="fas fa-plus"></i> Manage Banks</button>
            </div>
            <div class="fo-metrics">
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(data.cash)}</div><div class="fo-metric-label">Total Cash</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(data.blocked)}</div><div class="fo-metric-label">Blocked</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(data.refunds)}</div><div class="fo-metric-label">Refunds</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(data.net_worth?.net_worth)}</div><div class="fo-metric-label">Net Worth</div></div>
            </div>
            <div class="fo-grid-2">
                <div class="fo-panel">
                    <div class="fo-panel-title">Settlement Dashboard</div>
                    <p>Receivable: <strong style="color:var(--fo-emerald)">${fmt(s.outstanding_receivable)}</strong></p>
                    <p>Payable: <strong style="color:var(--fo-rose)">${fmt(s.outstanding_payable)}</strong></p>
                    <p>Pending &gt;30d: ${s.pending_over_30} (${fmt(s.pending_amount_30)})</p>
                    <p>Pending &gt;60d: ${s.pending_over_60} (${fmt(s.pending_amount_60)})</p>
                    <button class="btn btn-secondary" style="margin-top:1rem" onclick="loadView('transfers')">Transfer Manager →</button>
                </div>
                <div class="fo-panel">
                    <div class="fo-panel-title">Live Bank Balances</div>
                    ${(data.bank_strip || []).map(b => `<p><strong>${b.bank_name}</strong> ${fmtCr(b.balance)} <small>(avail ${fmtCr(b.available)})</small></p>`).join('')}
                </div>
            </div>
        `;
    }

    // ========== INVESTOR MASTER ==========
    async function loadInvestorMasterView() {
        const el = document.getElementById('content-area');
        el.innerHTML = '<div class="fo-panel">Loading investors...</div>';
        const rows = await foFetch('/investors');
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-users"></i> Investor Master</h1>
                <button class="btn btn-primary" onclick="openFOInvestorModal()"><i class="fas fa-plus"></i> Add Investor</button>
            </div>
            <div class="fo-investor-grid">
                ${rows.map(inv => `
                    <div class="fo-investor-card" onclick="openFOInvestorProfile(${inv.id})">
                        <div style="display:flex;justify-content:space-between;align-items:start">
                            <div>
                                <span class="fo-priority-badge">#${inv.priority_rank || '—'}</span>
                                <strong style="margin-left:0.5rem;color:var(--fo-heading)">${inv.name}</strong>
                                ${!inv.is_active ? '<span style="opacity:0.5"> (inactive)</span>' : ''}
                            </div>
                            <span class="fo-risk-${(inv.risk_category || 'medium').toLowerCase()}">${inv.risk_category || 'Medium'}</span>
                        </div>
                        <div style="margin-top:0.75rem;font-size:0.8rem;color:var(--fo-text)">
                            ${inv.pan ? `PAN ${inv.pan} · ` : ''}${inv.broker || 'No broker'} · ${inv.family_group || '—'}
                        </div>
                        ${inv.metrics ? `
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:1rem;font-size:0.75rem">
                                <div>Apps: <strong>${inv.metrics.total_applications}</strong></div>
                                <div>Allot %: <strong>${inv.metrics.allotment_pct}%</strong></div>
                                <div>Profit: <strong style="color:var(--fo-emerald)">${fmt(inv.metrics.total_profit)}</strong></div>
                                <div>Holdings: <strong>${fmt(inv.metrics.holdings_value)}</strong></div>
                            </div>
                        ` : ''}
                    </div>
                `).join('') || '<p>No investors. Add your first family member.</p>'}
            </div>
        `;
    }

    window.openFOInvestorProfile = async function (id) {
        const p = await foFetch(`/investors/${id}/profile`);
        showFOModal(p.name, `
            <div style="max-height:60vh;overflow:auto">
                <div class="fo-metrics" style="margin-bottom:1rem">
                    <div class="fo-metric"><div class="fo-metric-value">${p.metrics?.total_applications || 0}</div><div class="fo-metric-label">Applications</div></div>
                    <div class="fo-metric"><div class="fo-metric-value">${p.metrics?.allotment_pct || 0}%</div><div class="fo-metric-label">Allot Rate</div></div>
                    <div class="fo-metric"><div class="fo-metric-value">${fmt(p.metrics?.total_profit || 0)}</div><div class="fo-metric-label">Profit</div></div>
                    <div class="fo-metric"><div class="fo-metric-value">${fmt(p.metrics?.holdings_value || 0)}</div><div class="fo-metric-label">Holdings</div></div>
                </div>
                <p style="font-size:0.85rem"><strong>PAN:</strong> ${p.pan || '—'} · <strong>Demat:</strong> ${p.demat_account || '—'} · <strong>Broker:</strong> ${p.broker || '—'}</p>
                ${(p.contacts || []).length ? `<p style="font-size:0.8rem;margin-top:0.5rem"><strong>Network:</strong> ${p.contacts.map(c => c.contact_type + ': ' + c.name).join(' · ')}</p>` : ''}
                <h4 style="margin:1rem 0 0.5rem;color:var(--fo-heading)">Recent Applications</h4>
                ${(p.applications || []).slice(0, 8).map(a => `<div style="font-size:0.8rem;padding:0.35rem 0;border-bottom:1px solid var(--fo-border)">${a.ipo_name} — <span class="org-badge">${a.status}</span> ${fmt(a.application_amount)}</div>`).join('') || '<p style="opacity:0.7">No applications</p>'}
                <div style="margin-top:1rem;display:flex;gap:0.5rem">
                    <button class="btn btn-primary" onclick="closeFOModal();openFOInvestorModal(${id})">Edit</button>
                    <button class="btn btn-secondary" onclick="closeFOModal();loadView('investor-wise')">All Apps</button>
                </div>
            </div>
        `);
    };

    window.openFOInvestorModal = async function (id) {
        let inv = { name: '', pan: '', demat_account: '', broker: '', upi: '', family_group: '', relationship: '', priority_rank: 10, risk_category: 'Medium', profit_sharing_pct: 0, is_active: true, banks: '', contacts: [] };
        if (id) {
            inv = await foFetch(`/investors/${id}`);
        }
        showFOModal('Investor', `
            <form id="fo-inv-form" class="form-row" style="display:grid;gap:0.75rem">
                <input type="hidden" id="fo-inv-id" value="${inv.id || ''}">
                <div class="form-group"><label>Name *</label><input id="fo-inv-name" value="${inv.name || ''}" required></div>
                <div class="form-row"><div class="form-group"><label>PAN</label><input id="fo-inv-pan" value="${inv.pan || ''}"></div>
                <div class="form-group"><label>Demat</label><input id="fo-inv-demat" value="${inv.demat_account || ''}"></div></div>
                <div class="form-row"><div class="form-group"><label>Broker</label><input id="fo-inv-broker" value="${inv.broker || ''}"></div>
                <div class="form-group"><label>UPI</label><input id="fo-inv-upi" value="${inv.upi || ''}"></div></div>
                <div class="form-row"><div class="form-group"><label>Family Group</label><input id="fo-inv-fg" value="${inv.family_group || ''}"></div>
                <div class="form-group"><label>Relationship</label><input id="fo-inv-rel" value="${inv.relationship || ''}"></div></div>
                <div class="form-row"><div class="form-group"><label>Priority Rank (1=high)</label><input type="number" id="fo-inv-pri" value="${inv.priority_rank || 10}"></div>
                <div class="form-group"><label>Risk</label><select id="fo-inv-risk"><option ${inv.risk_category==='Low'?'selected':''}>Low</option><option ${inv.risk_category==='Medium'?'selected':''}>Medium</option><option ${inv.risk_category==='High'?'selected':''}>High</option></select></div></div>
                <div class="form-group"><label>Banks (comma-separated)</label><input id="fo-inv-banks" value="${inv.banks || ''}"></div>
                <div class="form-group"><label>Network (Father, Mother, Wife, Children, Friends, Relatives)</label>
                    <div id="fo-contacts-list" class="fo-contact-grid"></div>
                    <button type="button" class="btn btn-secondary" style="margin-top:0.5rem" onclick="addFOContactRow()">+ Add Contact</button>
                </div>
                <button type="submit" class="btn btn-primary">Save Investor</button>
            </form>
        `);
        const contactTypes = ['Father', 'Mother', 'Wife', 'Child', 'Friend', 'Relative'];
        window._foContacts = (inv.contacts || []).length ? [...inv.contacts] : [];
        function renderContacts() {
            const list = document.getElementById('fo-contacts-list');
            if (!list) return;
            list.innerHTML = window._foContacts.map((c, i) => `
                <select onchange="window._foContacts[${i}].contact_type=this.value">${contactTypes.map(t => `<option ${c.contact_type===t?'selected':''}>${t}</option>`).join('')}</select>
                <input placeholder="Name" value="${c.name || ''}" onchange="window._foContacts[${i}].name=this.value">
            `).join('');
        }
        window.addFOContactRow = function () {
            window._foContacts.push({ contact_type: 'Friend', name: '' });
            renderContacts();
        };
        renderContacts();
        document.getElementById('fo-inv-form').onsubmit = async (e) => {
            e.preventDefault();
            const body = {
                name: document.getElementById('fo-inv-name').value,
                pan: document.getElementById('fo-inv-pan').value,
                demat_account: document.getElementById('fo-inv-demat').value,
                broker: document.getElementById('fo-inv-broker').value,
                upi: document.getElementById('fo-inv-upi').value,
                family_group: document.getElementById('fo-inv-fg').value,
                relationship: document.getElementById('fo-inv-rel').value,
                priority_rank: parseInt(document.getElementById('fo-inv-pri').value) || 10,
                risk_category: document.getElementById('fo-inv-risk').value,
                banks: document.getElementById('fo-inv-banks').value,
                is_active: true,
                contacts: window._foContacts.filter(c => c.name),
            };
            const iid = document.getElementById('fo-inv-id').value;
            await apiFetch(`${FO}/investors${iid ? '/' + iid : ''}`, { method: iid ? 'PUT' : 'POST', body });
            closeFOModal();
            showToast('Investor saved', 'success');
            loadInvestorMasterView();
        };
    };

    // ========== BANK MASTER ==========
    async function loadBankMasterView() {
        const el = document.getElementById('content-area');
        const banks = await foFetch('/banks');
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-university"></i> Bank Master</h1>
                <button class="btn btn-primary" onclick="openFOBankModal()"><i class="fas fa-plus"></i> Add Bank</button>
            </div>
            <div class="fo-treasury-strip">
                ${banks.map(b => `
                    <div class="fo-bank-chip" onclick="openFOBankModal(${b.id})">
                        <div class="name">${b.bank_name}</div>
                        <div class="bal">${fmtCr(b.current_balance)}</div>
                        <div class="sub">ASBA cap ${fmtCr(b.asba_limit)} · Blocked ${fmtCr(b.blocked_balance)}</div>
                        <div class="sub">${(b.linked_investors || []).join(', ') || 'No links'}</div>
                    </div>
                `).join('') || '<p>No banks yet.</p>'}
            </div>
        `;
    }

    window.openFOBankModal = async function (id) {
        let b = { bank_name: '', account_number: '', current_balance: 0, asba_limit: 0, linked_investors: [] };
        const investors = await foFetch('/investors');
        if (id) {
            const banks = await foFetch('/banks');
            b = banks.find(x => x.id === id) || b;
        }
        const linkedNames = b.linked_investors || [];
        showFOModal('Bank Account', `
            <form id="fo-bank-form">
                <input type="hidden" id="fo-bank-id" value="${b.id || ''}">
                <div class="form-group"><label>Bank Name *</label><input id="fo-bank-name" value="${b.bank_name || ''}" required></div>
                <div class="form-group"><label>Account Number</label><input id="fo-bank-acc" value="${b.account_number || ''}"></div>
                <div class="form-row"><div class="form-group"><label>Current Balance ₹</label><input type="number" id="fo-bank-bal" value="${b.current_balance || 0}"></div>
                <div class="form-group"><label>ASBA Limit ₹</label><input type="number" id="fo-bank-asba" value="${b.asba_limit || 0}"></div></div>
                <div class="form-group"><label>Linked Investors</label>
                    <select id="fo-bank-invs" multiple style="min-height:100px;width:100%">
                        ${investors.map(i => `<option value="${i.id}" ${linkedNames.includes(i.name)?'selected':''}>${i.name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Save Bank</button>
            </form>
        `);
        document.getElementById('fo-bank-form').onsubmit = async (e) => {
            e.preventDefault();
            const invSel = document.getElementById('fo-bank-invs');
            const investor_ids = Array.from(invSel.selectedOptions).map(o => parseInt(o.value));
            const body = {
                bank_name: document.getElementById('fo-bank-name').value,
                account_number: document.getElementById('fo-bank-acc').value,
                current_balance: parseFloat(document.getElementById('fo-bank-bal').value) || 0,
                available_balance: parseFloat(document.getElementById('fo-bank-bal').value) || 0,
                asba_limit: parseFloat(document.getElementById('fo-bank-asba').value) || 0,
                investor_ids,
            };
            const bid = document.getElementById('fo-bank-id').value;
            await apiFetch(`${FO}/banks${bid ? '/' + bid : ''}`, { method: bid ? 'PUT' : 'POST', body });
            closeFOModal();
            showToast('Bank saved', 'success');
            loadBankMasterView();
        };
    };

    // ========== IPO MASTER ==========
    async function loadIPOMasterView() {
        const el = document.getElementById('content-area');
        const ipos = await foFetch('/ipos');
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-building"></i> IPO Master</h1>
                <div style="display:flex;gap:0.5rem">
                    <button class="btn btn-secondary" onclick="refreshAllGMP()"><i class="fas fa-sync"></i> Refresh GMP</button>
                    <button class="btn btn-primary" onclick="loadView('ipos')"><i class="fas fa-plus"></i> Add IPO</button>
                </div>
            </div>
            <div class="table-container fo-panel">
                <table class="data-table">
                    <thead><tr><th>IPO</th><th>Score</th><th>GMP</th><th>Rating</th><th>Risk</th><th>Funding Req</th><th>Applied</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${ipos.map(i => `
                            <tr>
                                <td><strong>${i.ipo_name}</strong><br><small>${i.lifecycle_stage || i.status}</small></td>
                                <td><div class="fo-score-ring" style="width:40px;height:40px;font-size:0.75rem">${Math.round(i.ipo_score || 70)}</div></td>
                                <td>${i.gmp != null ? fmt(i.gmp) : '—'}</td>
                                <td>${i.ai_rating || 'B+'}</td>
                                <td class="fo-risk-${(i.risk_rating || 'medium').toLowerCase()}">${i.risk_rating || 'Medium'}</td>
                                <td>${fmt(i.funding_requirement || 0)}</td>
                                <td>${i.applied_count || 0} / ${i.allotted_count || 0}</td>
                                <td><button class="btn btn-secondary btn-sm" onclick="enrichIPO(${i.id})">Enrich</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.enrichIPO = async function (id) {
        await apiFetch(`${FO}/ipos/${id}/enrich`, { method: 'POST', body: {} });
        showToast('IPO scores updated', 'success');
        loadIPOMasterView();
    };

    // ========== ALLOCATION ==========
    async function loadAllocationView() {
        const el = document.getElementById('content-area');
        const ipos = await foFetch('/ipos');
        const treasury = await foFetch('/treasury');
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-magic"></i> AI Allocation Engine</h1>
            </div>
            <div class="fo-panel">
                <div class="form-row" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:end">
                    <div class="form-group"><label>IPO</label>
                        <select id="alloc-ipo">${ipos.map(i => `<option value="${i.id}">${i.ipo_name}</option>`).join('')}</select>
                    </div>
                    <div class="form-group"><label>Available Funds ₹</label>
                        <input type="number" id="alloc-funds" value="${treasury.available_for_ipo || 5000000}">
                    </div>
                    <button class="btn btn-primary" onclick="runAllocation()"><i class="fas fa-bolt"></i> Optimize Allocation</button>
                </div>
                <div id="alloc-result" style="margin-top:1.5rem"></div>
            </div>
        `;
    }

    window.runAllocation = async function () {
        const ipoId = document.getElementById('alloc-ipo').value;
        const funds = document.getElementById('alloc-funds').value;
        const result = await foFetch('/allocation/optimize', { method: 'POST', body: { ipo_id: parseInt(ipoId), available_funds: parseFloat(funds) } });
        const box = document.getElementById('alloc-result');
        if (result.error) { box.innerHTML = `<p style="color:var(--fo-rose)">${result.error}</p>`; return; }
        box.innerHTML = `
            <h3 style="color:var(--fo-heading)">${result.ipo_name} — Expected profit ${fmt(result.expected_profit)}</h3>
            <p>Funds used: ${fmt(result.funds_used)} · Remaining: ${fmt(result.funds_remaining)}</p>
            <div class="fo-grid-2" style="margin-top:1rem">
                <div><strong class="fo-apply-row">✓ Apply (${result.apply.length})</strong>
                    <ul>${result.apply.map(a => `<li class="fo-apply-row">${a.investor_name} — ${a.reason}</li>`).join('')}</ul>
                </div>
                <div><strong class="fo-skip-row">✗ Skip (${result.skip.length})</strong>
                    <ul>${result.skip.slice(0, 8).map(s => `<li class="fo-skip-row">${s.investor_name} — ${s.reason}</li>`).join('')}</ul>
                </div>
            </div>
            <button class="btn btn-primary" style="margin-top:1rem" onclick="executeAlloc(${result.ipo_id}, [${result.apply.map(a => a.investor_id).join(',')}])">
                Apply Selected (${result.apply.length})
            </button>
        `;
    };

    window.executeAlloc = async function (ipoId, ids) {
        const r = await foFetch('/allocation/execute', { method: 'POST', body: { ipo_id: ipoId, investor_ids: ids } });
        showToast(`Created ${r.created} applications`, 'success');
        loadView('kanban');
    };

    // ========== KANBAN ==========
    async function loadKanbanView() {
        const el = document.getElementById('content-area');
        const data = await foFetch('/kanban');
        const board = data.board || {};
        const stages = data.stages || [];
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-columns"></i> Application Kanban</h1>
                <button class="btn btn-secondary" onclick="loadView('applications')">Table View</button>
            </div>
            <p style="font-size:0.8rem;opacity:0.7;margin-bottom:1rem">Drag cards between columns or click to advance stage</p>
            <div class="fo-kanban" id="fo-kanban-board">
                ${stages.map(stage => `
                    <div class="fo-kanban-col" data-stage="${stage}"
                         ondragover="event.preventDefault();this.classList.add('drag-over')"
                         ondragleave="this.classList.remove('drag-over')"
                         ondrop="dropKanban(event,'${stage}')">
                        <div class="fo-kanban-col-header">${stage} (${(board[stage] || []).length})</div>
                        ${(board[stage] || []).map(c => `
                            <div class="fo-kanban-card" draggable="true" data-app-id="${c.id}"
                                 ondragstart="event.dataTransfer.setData('appId','${c.id}');this.classList.add('dragging')"
                                 ondragend="this.classList.remove('dragging')"
                                 onclick="moveKanban(${c.id}, '${stage}')">
                                <strong>${c.investor_name}</strong>
                                <small>${c.ipo_name}</small>
                                <small>${fmt(c.application_amount)}</small>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }

    window.dropKanban = async function (e, stage) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const appId = e.dataTransfer.getData('appId');
        if (!appId) return;
        await apiFetch(`${FO}/kanban/${appId}/move`, { method: 'PUT', body: { kanban_stage: stage } });
        showToast(`Moved to ${stage}`, 'success');
        loadKanbanView();
    };

    window.moveKanban = async function (appId, current) {
        const stages = ['Draft', 'Applied', 'ASBA Blocked', 'Allotted', 'Refunded', 'Listed', 'Sold'];
        const idx = stages.indexOf(current);
        const next = stages[Math.min(idx + 1, stages.length - 1)];
        if (next === current) return;
        await apiFetch(`${FO}/kanban/${appId}/move`, { method: 'PUT', body: { kanban_stage: next } });
        showToast(`Moved to ${next}`, 'success');
        loadKanbanView();
    };

    // ========== TRANSFERS ==========
    async function loadTransfersView() {
        const el = document.getElementById('content-area');
        const data = await foFetch('/transfers');
        const s = data.settlement || {};
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-exchange-alt"></i> Transfer Manager</h1>
                <button class="btn btn-primary" onclick="openFOTransferModal()"><i class="fas fa-plus"></i> New Transfer</button>
            </div>
            <div class="fo-metrics" style="margin-bottom:1.5rem">
                <div class="fo-metric"><div class="fo-metric-value" style="color:var(--fo-emerald)">${fmt(s.outstanding_receivable)}</div><div class="fo-metric-label">Receivable</div></div>
                <div class="fo-metric"><div class="fo-metric-value" style="color:var(--fo-rose)">${fmt(s.outstanding_payable)}</div><div class="fo-metric-label">Payable</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${s.pending_over_30}</div><div class="fo-metric-label">Pending &gt;30d</div></div>
            </div>
            <div class="fo-panel table-container">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Purpose</th><th>IPO</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                        ${(data.transfers || []).map(t => `
                            <tr>
                                <td>${t.transfer_date || '—'}</td>
                                <td>${t.from_person}</td>
                                <td>${t.to_person}</td>
                                <td><strong>${fmt(t.amount)}</strong></td>
                                <td>${t.purpose || '—'}</td>
                                <td>${t.ipo_name || '—'}</td>
                                <td><span class="org-badge">${t.status}</span></td>
                                <td>${t.status === 'Pending' ? `<button class="btn btn-secondary btn-sm" onclick="settleTransfer(${t.id})">Settle</button>` : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.openFOTransferModal = async function () {
        const [investors, ipos] = await Promise.all([
            foFetch('/investors'),
            foFetch('/ipos'),
        ]);
        const invOpts = (investors || []).map(i =>
            `<option value="${i.id}">${i.name}${i.family_group ? ' (' + i.family_group + ')' : ''}</option>`
        ).join('');
        const ipoOpts = '<option value="">— None —</option>' + (ipos || []).map(i =>
            `<option value="${i.id}">${i.ipo_name}</option>`
        ).join('');
        showFOModal('New Transfer', `
            <form id="fo-tx-form">
                <div class="form-row">
                    <div class="form-group"><label>From</label>
                        <select id="fo-tx-from-id">
                            <option value="">You (Desk)</option>
                            ${invOpts}
                        </select>
                    </div>
                    <div class="form-group"><label>To *</label>
                        <select id="fo-tx-to-id" required>
                            <option value="">Select investor...</option>
                            ${invOpts}
                        </select>
                    </div>
                </div>
                <div class="form-group"><label>Amount ₹ *</label><input type="number" id="fo-tx-amt" required min="1"></div>
                <div class="form-row">
                    <div class="form-group"><label>IPO Reference</label>
                        <select id="fo-tx-ipo">${ipoOpts}</select>
                    </div>
                    <div class="form-group"><label>Purpose</label>
                        <input id="fo-tx-purpose" placeholder="For IPO application">
                    </div>
                </div>
                <div class="form-group"><label>Due date (optional)</label><input type="date" id="fo-tx-due"></div>
                <button type="submit" class="btn btn-primary">Record Transfer</button>
            </form>
        `);
        document.getElementById('fo-tx-form').onsubmit = async (e) => {
            e.preventDefault();
            const toId = document.getElementById('fo-tx-to-id').value;
            if (!toId) { showToast('Select recipient', 'error'); return; }
            const fromId = document.getElementById('fo-tx-from-id').value;
            const ipoId = document.getElementById('fo-tx-ipo').value;
            const due = document.getElementById('fo-tx-due').value;
            let purpose = document.getElementById('fo-tx-purpose').value;
            if (!purpose && ipoId) {
                const ipoName = ipos.find(i => String(i.id) === ipoId)?.ipo_name;
                if (ipoName) purpose = `For ${ipoName} IPO`;
            }
            await apiFetch(`${FO}/transfers`, { method: 'POST', body: {
                from_investor_id: fromId ? parseInt(fromId) : null,
                to_investor_id: parseInt(toId),
                amount: parseFloat(document.getElementById('fo-tx-amt').value),
                purpose,
                ipo_id: ipoId ? parseInt(ipoId) : null,
                settlement_due_date: due || null,
                status: 'Pending',
            }});
            closeFOModal();
            showToast('Transfer recorded', 'success');
            loadTransfersView();
        };
    };

    window.settleTransfer = async function (id) {
        await apiFetch(`${FO}/transfers/${id}`, { method: 'PUT', body: { status: 'Settled' } });
        showToast('Settled', 'success');
        loadTransfersView();
    };

    window.checkRegistrar = async function (ipoId, applyUpdates) {
        const box = document.getElementById(`registrar-results-${ipoId}`);
        if (box) box.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Checking registrar for all investors with PAN...</p>';
        showToast('Checking registrar...', 'info');
        const res = await apiFetch(`${FO}/allotment-center/${ipoId}/check-registrar`, {
            method: 'POST',
            body: { apply_updates: applyUpdates },
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Check failed', 'error');
            if (box) box.innerHTML = '';
            return;
        }
        showToast(`Checked ${data.checked}: ${data.allotted_found} allotted, ${data.not_allotted_found} not allotted` +
            (applyUpdates ? ` · ${data.applications_updated} updated` : ''), 'success');
        if (box) {
            box.innerHTML = `
                <table class="data-table" style="margin-top:0.75rem;font-size:0.8rem">
                    <thead><tr><th>Investor</th><th>PAN</th><th>Registrar</th><th>Result</th><th>Message</th></tr></thead>
                    <tbody>
                        ${(data.results || []).map(r => `<tr>
                            <td>${r.investor_name}</td>
                            <td>${r.pan || '—'}</td>
                            <td>${r.registrar || '—'}</td>
                            <td><span class="org-badge" style="background:${r.status==='Allotted'?'#10b98133':r.status==='Not Allotted'?'#ef444433':'#64748b33'}">${r.status}</span></td>
                            <td style="font-size:0.75rem">${r.message || ''}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;
        }
        if (applyUpdates) loadAllotmentView();
    };

    // ========== ALLOTMENT ==========
    async function loadAllotmentView() {
        const el = document.getElementById('content-area');
        const rows = await foFetch('/allotment-center');
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-trophy"></i> Allotment Center</h1>
            </div>
            <div class="fo-investor-grid">
                ${rows.map(r => `
                    <div class="fo-panel">
                        <h3 style="color:var(--fo-heading)">${r.ipo_name}</h3>
                        <div class="fo-metrics" style="margin-top:1rem">
                            <div class="fo-metric"><div class="fo-metric-value">${r.applied}</div><div class="fo-metric-label">Applied</div></div>
                            <div class="fo-metric"><div class="fo-metric-value" style="color:var(--fo-emerald)">${r.allotted}</div><div class="fo-metric-label">Allotted</div></div>
                            <div class="fo-metric"><div class="fo-metric-value">${r.success_rate_pct}%</div><div class="fo-metric-label">Success</div></div>
                            <div class="fo-metric"><div class="fo-metric-value">${fmt(r.expected_profit)}</div><div class="fo-metric-label">Profit</div></div>
                        </div>
                        <p style="margin-top:0.75rem;font-size:0.8rem"><i class="fas fa-building"></i> Registrar: <strong>${r.registrar}</strong></p>
                        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.5rem">
                            <button class="btn btn-primary btn-sm" onclick="checkRegistrar(${r.ipo_id}, false)"><i class="fas fa-search"></i> Check Registrar</button>
                            <button class="btn btn-secondary btn-sm" onclick="checkRegistrar(${r.ipo_id}, true)"><i class="fas fa-check-double"></i> Check &amp; Apply</button>
                            <a class="fo-registrar-link" href="${r.portal_url}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Portal</a>
                            <button class="btn btn-secondary btn-sm" onclick="openBulkAllotmentModal(${r.ipo_id}, '${String(r.ipo_name).replace(/'/g, "\\'")}')"><i class="fas fa-file-excel"></i> Bulk Import</button>
                        </div>
                        <div id="registrar-results-${r.ipo_id}"></div>
                        <p style="font-size:0.7rem;opacity:0.6;margin-top:0.5rem">${r.note || ''}</p>
                    </div>
                `).join('') || '<p>No IPOs yet.</p>'}
            </div>
        `;
    }

    // ========== PORTFOLIO ==========
    function handleBrokerCallback() {
        const p = new URLSearchParams(window.location.search);
        if (p.get('broker') === 'zerodha_connected') {
            showToast('Zerodha connected — live holdings synced!', 'success');
            history.replaceState({}, '', '/');
            setTimeout(() => loadView('portfolio'), 300);
        } else if (p.get('broker_error')) {
            showToast('Broker error: ' + decodeURIComponent(p.get('broker_error')), 'error');
            history.replaceState({}, '', '/');
        }
    }

    async function loadPortfolioView() {
        const el = document.getElementById('content-area');
        const [data, kite] = await Promise.all([
            foFetch('/portfolio'),
            foFetch('/broker/zerodha/status'),
        ]);
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-chart-pie"></i> Portfolio Tracker</h1>
                <div>
                    <button class="btn btn-secondary" onclick="refreshPortfolio()"><i class="fas fa-sync"></i> Sync Holdings</button>
                    <button class="btn btn-primary" onclick="connectBroker()"><i class="fas fa-link"></i> Connect Broker</button>
                </div>
            </div>
            ${kite.configured ? `<p style="font-size:0.8rem;opacity:0.75;margin-bottom:1rem"><i class="fas fa-check-circle" style="color:var(--fo-emerald)"></i> Zerodha Kite Connect ready · Redirect: <code>${kite.redirect_uri}</code></p>` : `
            <div class="fo-panel" style="margin-bottom:1rem;border-color:var(--fo-gold)">
                <strong>Zerodha live sync</strong> — Add <code>KITE_API_KEY</code> and <code>KITE_API_SECRET</code> in cPanel env vars (see LIVE_SETUP.md).
                <br><small>${kite.setup_hint}</small>
            </div>`}
            <div class="fo-hero" style="padding:1.5rem">
                <div class="fo-hero-label">Family Portfolio</div>
                <div class="fo-hero-value" style="font-size:2rem">${fmtCr(data.family_total)}</div>
            </div>
            ${(data.investors || []).map(inv => `
                <div class="fo-panel" style="margin-top:1rem">
                    <h3 style="color:var(--fo-heading)">${inv.investor_name} — ${fmtCr(inv.total_value)}</h3>
                    <div style="margin:0.75rem 0">
                        ${(inv.brokers || []).map(b => `
                            <span class="fo-broker-card ${b.connected ? 'connected' : ''}" title="${b.client_id || ''}">
                                ${b.broker} ${b.live ? '⚡' : ''} ${fmtCr(b.value)}
                                ${b.broker === 'Zerodha' && b.connection_id ? `<button class="btn-icon" style="margin-left:4px" onclick="event.stopPropagation();disconnectZerodha(${b.connection_id})" title="Disconnect"><i class="fas fa-unlink"></i></button>` : ''}
                            </span>`).join('')}
                    </div>
                    ${inv.holdings?.length ? `<table class="data-table"><thead><tr><th>Symbol</th><th>Qty</th><th>LTP</th><th>Value</th><th>P&L</th></tr></thead>
                        <tbody>${inv.holdings.map(h => `<tr><td>${h.symbol}</td><td>${h.quantity}</td><td>${fmt(h.ltp)}</td><td>${fmt(h.market_value)}</td><td style="color:${h.pnl>=0?'var(--fo-emerald)':'var(--fo-rose)'}">${fmt(h.pnl)}</td></tr>`).join('')}</tbody></table>` : '<p style="opacity:0.7">Connect a broker to see holdings</p>'}
                </div>
            `).join('')}
        `;
    }

    window.refreshPortfolio = async function () {
        await foFetch('/portfolio/refresh', { method: 'POST' });
        showToast('Prices updated', 'success');
        loadPortfolioView();
    };

    window.disconnectZerodha = async function (connId) {
        if (!confirm('Disconnect Zerodha and remove synced holdings?')) return;
        await apiFetch(`${FO}/broker/zerodha/disconnect/${connId}`, { method: 'POST', body: {} });
        showToast('Zerodha disconnected', 'success');
        loadPortfolioView();
    };

    window.connectBroker = async function () {
        const [investors, kite] = await Promise.all([
            foFetch('/investors'),
            foFetch('/broker/zerodha/status'),
        ]);
        const brokers = ['Zerodha', 'Angel One', 'Groww', 'Upstox'];
        if (!investors.length) { showToast('Add investors first', 'error'); return; }
        showFOModal('Connect Broker', `
            <form id="fo-broker-form">
                <div class="form-group"><label>Investor</label>
                    <select id="fo-broker-inv">${investors.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Broker</label>
                    <select id="fo-broker-name">${brokers.map(b => `<option>${b}</option>`).join('')}</select>
                </div>
                <div id="fo-broker-hint" style="font-size:0.8rem;opacity:0.8;margin-bottom:0.75rem"></div>
                <button type="submit" class="btn btn-primary" id="fo-broker-submit">Connect</button>
            </form>
        `);
        const nameSel = document.getElementById('fo-broker-name');
        const hint = document.getElementById('fo-broker-hint');
        const updateHint = () => {
            if (nameSel.value === 'Zerodha' && kite.configured) {
                hint.innerHTML = '<i class="fas fa-bolt"></i> Opens Zerodha login — live holdings via Kite Connect';
            } else if (nameSel.value === 'Zerodha') {
                hint.textContent = 'Configure KITE_API_KEY in cPanel env vars for live sync. Until then, demo holdings only.';
            } else {
                hint.textContent = 'Demo mode: sample holdings until Angel/Groww/Upstox OAuth is added.';
            }
        };
        nameSel.onchange = updateHint;
        updateHint();
        document.getElementById('fo-broker-form').onsubmit = async (e) => {
            e.preventDefault();
            const investorId = parseInt(document.getElementById('fo-broker-inv').value);
            const brokerName = document.getElementById('fo-broker-name').value;
            if (brokerName === 'Zerodha' && kite.configured) {
                const res = await apiFetch(`${FO}/broker/zerodha/start`, { method: 'POST', body: { investor_id: investorId } });
                const data = await res.json();
                if (data.login_url) {
                    closeFOModal();
                    window.location.href = data.login_url;
                } else showToast(data.error || 'Failed', 'error');
                return;
            }
            const res = await apiFetch(`${FO}/portfolio/connect`, { method: 'POST', body: {
                investor_id: investorId,
                broker_name: brokerName,
            }});
            const data = await res.json();
            closeFOModal();
            showToast(data.demo ? 'Demo broker connected' : 'Broker connected', 'success');
            loadPortfolioView();
        };
    };

    // ========== WEALTH ==========
    async function loadWealthView() {
        const el = document.getElementById('content-area');
        const data = await foFetch('/wealth');
        const b = data.breakdown || {};
        const assets = data.assets || [];
        el.innerHTML = `
            <div class="fo-page-header">
                <h1><i class="fas fa-gem"></i> Family Net Worth</h1>
                <div style="display:flex;gap:0.5rem">
                    <button class="btn btn-secondary" onclick="exportFOReport()"><i class="fas fa-file-excel"></i> Export</button>
                    <button class="btn btn-primary" onclick="openFOWealthModal()"><i class="fas fa-plus"></i> Add Asset</button>
                </div>
            </div>
            <div class="fo-hero"><div class="fo-hero-value">${fmtCr(data.net_worth?.net_worth)}</div></div>
            <div class="fo-metrics">
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.cash)}</div><div class="fo-metric-label">Cash</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.stocks)}</div><div class="fo-metric-label">Stocks</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.ipo)}</div><div class="fo-metric-label">IPO Holdings</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.mutual_funds)}</div><div class="fo-metric-label">Mutual Funds</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.etf)}</div><div class="fo-metric-label">ETF</div></div>
                <div class="fo-metric"><div class="fo-metric-value">${fmtCr(b.loans_given)}</div><div class="fo-metric-label">Loans Given</div></div>
            </div>
            <div class="fo-panel" style="margin-top:1.5rem">
                <div class="fo-panel-title"><i class="fas fa-list"></i> Manual Assets (MF, ETF, Loans)</div>
                ${assets.map(a => `
                    <div class="fo-wealth-row">
                        <div><strong style="color:var(--fo-heading)">${a.name}</strong><br><small>${a.asset_type}</small></div>
                        <div style="display:flex;align-items:center;gap:0.5rem">
                            <strong style="color:var(--fo-gold)">${fmt(a.value)}</strong>
                            <button class="btn-icon delete" onclick="deleteFOAsset(${a.id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('') || '<p style="opacity:0.7">No manual assets. Add MF, ETF, or loans.</p>'}
            </div>
        `;
    }

    window.openFOWealthModal = function () {
        showFOModal('Add Asset', `
            <form id="fo-wealth-form">
                <div class="form-group"><label>Type</label>
                    <select id="fo-w-type"><option>Mutual Fund</option><option>ETF</option><option>Loan Given</option><option>Loan Taken</option><option>Cash</option></select>
                </div>
                <div class="form-group"><label>Name</label><input id="fo-w-name" required></div>
                <div class="form-group"><label>Value ₹</label><input type="number" id="fo-w-val" required></div>
                <button type="submit" class="btn btn-primary">Add</button>
            </form>
        `);
        document.getElementById('fo-wealth-form').onsubmit = async (e) => {
            e.preventDefault();
            await apiFetch(`${FO}/wealth/assets`, { method: 'POST', body: {
                asset_type: document.getElementById('fo-w-type').value,
                name: document.getElementById('fo-w-name').value,
                value: parseFloat(document.getElementById('fo-w-val').value),
            }});
            closeFOModal();
            showToast('Asset added', 'success');
            loadWealthView();
        };
    };

    window.deleteFOAsset = async function (id) {
        if (!confirm('Remove this asset?')) return;
        await apiFetch(`${FO}/wealth/assets/${id}`, { method: 'DELETE' });
        showToast('Removed', 'success');
        loadWealthView();
    };

    // ========== AI ADVISOR ==========
    async function loadAdvisorView() {
        const el = document.getElementById('content-area');
        el.innerHTML = `
            <div class="fo-page-header"><h1><i class="fas fa-robot"></i> AI Advisor</h1></div>
            <div class="fo-panel fo-advisor">
                <div class="fo-advisor-messages" id="fo-advisor-msgs">
                    <div class="fo-msg ai">Ask me anything — e.g. <em>"Can I apply for the open IPO?"</em><br><br>I check balances, transfers, refunds, priority ranks, and IPO scores.</div>
                </div>
                <div class="fo-advisor-input">
                    <input type="text" id="fo-advisor-q" placeholder="Can I apply for NSDL IPO?" onkeydown="if(event.key==='Enter')askAdvisor()">
                    <button class="btn btn-primary" onclick="askAdvisor()"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
    }

    window.askAdvisor = async function () {
        const input = document.getElementById('fo-advisor-q');
        const q = input.value.trim();
        if (!q) return;
        const msgs = document.getElementById('fo-advisor-msgs');
        msgs.innerHTML += `<div class="fo-msg user">${q}</div>`;
        input.value = '';
        msgs.innerHTML += `<div class="fo-msg ai" id="fo-advisor-loading"><i class="fas fa-spinner fa-spin"></i> Analyzing treasury, transfers, IPO scores...</div>`;
        msgs.scrollTop = msgs.scrollHeight;
        const res = await foFetch('/advisor', { method: 'POST', body: { question: q } });
        document.getElementById('fo-advisor-loading')?.remove();
        const html = (res.answer || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        msgs.innerHTML += `<div class="fo-msg ai">${html}${res.expected_profit ? `<br><br><span style="color:var(--fo-emerald)">Expected profit: ${fmt(res.expected_profit)}</span>` : ''}</div>`;
        msgs.scrollTop = msgs.scrollHeight;
    };

    // ========== Modal helpers ==========
    function showFOModal(title, body) {
        let m = document.getElementById('fo-modal');
        if (!m) {
            m = document.createElement('div');
            m.id = 'fo-modal';
            m.className = 'modal';
            document.body.appendChild(m);
        }
        m.innerHTML = `<div class="modal-content" style="max-width:520px"><div class="modal-header"><h2>${title}</h2><button class="close" onclick="closeFOModal()"><i class="fas fa-times"></i></button></div>${body}</div>`;
        m.classList.remove('hidden');
    }

    window.closeFOModal = function () {
        const m = document.getElementById('fo-modal');
        if (m) m.classList.add('hidden');
    };

    window.initOrgSwitcher = initOrgSwitcher;
    window.loadHomeView = loadHomeView;
})();
