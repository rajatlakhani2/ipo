/**
 * IPO Control SaaS — extended views, auth UI, IPO-only features
 */

(function initSaas() {
    if (!requireAuth()) return;

    document.addEventListener('DOMContentLoaded', () => {
        updateUserProfileUI();
        setupGlobalSearch();
        setupLogout();
        patchLoadView();
        patchIPOModal();
        patchApplicationModal();
        handleBillingRedirect();
    });

    function handleBillingRedirect() {
        const p = new URLSearchParams(window.location.search);
        if (p.get('billing') === 'success') {
            showToast('Pro subscription active! Thank you.', 'success');
            history.replaceState({}, '', '/');
            apiFetch(`${API_BASE}/auth/me`).then(r => r.json()).then(data => {
                if (data.organization) {
                    const s = getSession();
                    if (s) {
                        s.organization = data.organization;
                        localStorage.setItem('ipo_session', JSON.stringify(s));
                        updateUserProfileUI();
                    }
                }
            });
        } else if (p.get('billing') === 'cancel') {
            showToast('Checkout canceled', 'info');
            history.replaceState({}, '', '/');
        }
    }

    function setupLogout() {
        const btn = document.getElementById('logout-btn');
        if (btn) btn.addEventListener('click', logout);
    }

    function patchLoadView() {
        const original = window.loadView;
        window.loadView = function (view) {
            if (view === 'command-board') return loadCommandBoardView();
            if (view === 'calendar') return loadCalendarView();
            if (view === 'upcoming') return loadUpcomingIPOsView();
            if (view === 'audit') return loadAuditView();
            if (view === 'settings') return loadSettingsViewSaas();
            return original(view);
        };
    }

    function setupGlobalSearch() {
        const input = document.getElementById('global-search');
        if (!input) return;
        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const q = input.value.trim();
                if (q.length < 2) {
                    hideSearchResults();
                    return;
                }
                const res = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                showSearchResults(data);
            }, 300);
        });
    }

    function hideSearchResults() {
        const el = document.getElementById('search-results');
        if (el) el.remove();
    }

    function showSearchResults(data) {
        hideSearchResults();
        const bar = document.querySelector('.search-bar');
        const box = document.createElement('div');
        box.id = 'search-results';
        box.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--card-bg);border:1px solid var(--border-color);border-radius:8px;margin-top:4px;max-height:320px;overflow:auto;z-index:50;padding:0.5rem';
        const items = [
            ...(data.investors || []).map(i => `<div class="search-hit" data-view="investors" style="padding:0.5rem;cursor:pointer"><i class="fas fa-user"></i> ${i.name}</div>`),
            ...(data.ipos || []).map(i => `<div class="search-hit" data-view="applications" style="padding:0.5rem;cursor:pointer"><i class="fas fa-building"></i> ${i.ipo_name}</div>`),
            ...(data.applications || []).map(a => `<div class="search-hit" data-view="applications" style="padding:0.5rem;cursor:pointer"><i class="fas fa-file"></i> ${a.investor_name} — ${a.ipo_name} (${a.status})</div>`),
        ];
        box.innerHTML = items.length ? items.join('') : '<div style="padding:0.5rem;opacity:0.7">No results</div>';
        bar.style.position = 'relative';
        bar.appendChild(box);
        box.querySelectorAll('.search-hit').forEach(el => {
            el.onclick = () => {
                loadView(el.dataset.view);
                hideSearchResults();
                input.value = '';
            };
        });
    }

    async function loadCommandBoardView() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<h1>Loading Command Board...</h1>';
        try {
            const [boardRes, summaryRes] = await Promise.all([
                apiFetch(`${API_BASE}/command-board`),
                apiFetch(`${API_BASE}/dashboard/summary`),
            ]);
            const board = await boardRes.json();
            const summary = await summaryRes.json();

            contentArea.innerHTML = `
                <div class="header-actions">
                    <h1><i class="fas fa-satellite-dish"></i> IPO Command Board</h1>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <button class="btn btn-secondary" onclick="loadView('calendar')"><i class="fas fa-calendar"></i> Calendar</button>
                        <button class="btn btn-primary" onclick="loadView('applications')"><i class="fas fa-clipboard-list"></i> IPO-wise</button>
                    </div>
                </div>
                <div class="dashboard-grid">
                    <div class="stat-card"><div class="stat-value">${board.open_ipo_count}</div><div class="stat-label">Open IPOs</div></div>
                    <div class="stat-card"><div class="stat-value">${board.not_applied_count}</div><div class="stat-label">Pending Applications</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(board.total_blocked)}</div><div class="stat-label">Total Blocked (ASBA)</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(summary.total_profit)}</div><div class="stat-label">Profit (Allotted)</div></div>
                </div>
                <div class="command-grid">
                    <div class="card">
                        <h2 style="margin-bottom:1rem;color:var(--heading-color)">Closing Soon (7 days)</h2>
                        ${board.closing_soon.length ? board.closing_soon.map(i => `<div class="alert-card" style="margin-bottom:0.5rem;border-color:var(--warning-color)"><strong>${i.ipo_name}</strong><br><small>Close: ${formatDate(i.bidding_close_date)}</small></div>`).join('') : '<p>No IPOs closing soon</p>'}
                    </div>
                    <div class="card">
                        <h2 style="margin-bottom:1rem;color:var(--heading-color)">Listing Soon</h2>
                        ${board.listing_soon.length ? board.listing_soon.map(i => `<div class="alert-card" style="margin-bottom:0.5rem;border-color:var(--success-color)"><strong>${i.ipo_name}</strong><br><small>Listing: ${formatDate(i.listing_date)}</small></div>`).join('') : '<p>No listings this week</p>'}
                    </div>
                    <div class="card">
                        <h2 style="margin-bottom:1rem;color:var(--heading-color)">Bank Headroom Alerts</h2>
                        ${board.bank_alerts.length ? board.bank_alerts.map(b => `<div class="alert-card" style="margin-bottom:0.5rem"><strong>${b.bank_name}</strong><br>Blocked ${formatCurrency(b.blocked)} / Cap ${formatCurrency(b.cap)}<br><small>Remaining ${formatCurrency(b.remaining)}</small></div>`).join('') : '<p>All banks within limits</p>'}
                    </div>
                </div>
                <div class="card" style="margin-top:1.5rem">
                    <h2 style="margin-bottom:1rem;color:var(--heading-color)">Investors Not Yet Applied</h2>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>Investor</th><th>IPO</th><th></th></tr></thead>
                            <tbody>
                                ${board.not_applied_preview.map(r => `<tr><td>${r.investor_name}</td><td>${r.ipo_name}</td><td><button class="btn btn-primary btn-sm" onclick="loadView('applications')">Go Apply</button></td></tr>`).join('') || '<tr><td colspan="3">All caught up</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) {
            contentArea.innerHTML = '<h1>Error loading command board</h1>';
        }
    }

    async function loadCalendarView() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<h1>Loading...</h1>';
        const res = await apiFetch(`${API_BASE}/calendar`);
        const events = await res.json();
        contentArea.innerHTML = `
            <div class="header-actions"><h1><i class="fas fa-calendar-alt"></i> IPO Calendar</h1></div>
            <div class="card">
                ${events.map(e => `
                    <div class="calendar-item">
                        <div><strong>${e.ipo_name}</strong> — ${e.event}</div>
                        <div>${formatDate(e.date)} <span class="org-badge">${e.lifecycle_stage}</span></div>
                    </div>
                `).join('') || '<p>No dated events. Add IPO dates in IPO management.</p>'}
            </div>
        `;
    }

    async function loadUpcomingIPOsView() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = '<h1>Loading IPO Feed...</h1>';

        let res = await apiFetch(`${API_BASE}/upcoming-ipos`);
        let data = await res.json();
        let rows = data.ipos || data;

        // Auto-fetch from Moneycontrol when feed is empty or stale (>6 hours)
        const staleMs = 6 * 60 * 60 * 1000;
        const lastSyncTs = data.last_synced_at ? new Date(data.last_synced_at).getTime() : 0;
        const needsFetch = !data.last_synced_at || (Date.now() - lastSyncTs > staleMs);
        if ((!Array.isArray(rows) || rows.length === 0 || needsFetch) && !window._ipoFeedFetching) {
            window._ipoFeedFetching = true;
            showToast('Syncing live IPOs from NSE & Chittorgarh...', 'info');
            const syncRes = await apiFetch(`${API_BASE}/upcoming-ipos/fetch-live`, { method: 'POST', body: {} });
            window._ipoFeedFetching = false;
            if (syncRes.ok) {
                res = await apiFetch(`${API_BASE}/upcoming-ipos`);
                data = await res.json();
                rows = data.ipos || data;
            }
        }

        const lastSync = data.last_synced_at ? new Date(data.last_synced_at).toLocaleString() : 'Never';

        const statusBadge = (s) => {
            const colors = { open: '#10b981', upcoming: '#3b82f6', closed: '#64748b', listed: '#8b5cf6' };
            const c = colors[s] || '#64748b';
            return `<span class="org-badge" style="background:${c}22;color:${c}">${(s || 'upcoming').toUpperCase()}</span>`;
        };

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1><i class="fas fa-rss"></i> Live IPO Feed</h1>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="fetchLiveIPOs()"><i class="fas fa-sync-alt"></i> Fetch Live IPOs</button>
                    <button class="btn btn-secondary" onclick="loadView('ipos')">My IPOs</button>
                </div>
            </div>
            <p style="margin-bottom:1rem;font-size:0.9rem;opacity:0.8">
                Sources: <strong>NSE</strong>, Moneycontrol, Chittorgarh, ShareMarketIPO &nbsp;|&nbsp; Last sync: ${lastSync}
            </p>
            <div class="card table-container">
                <table class="data-table">
                    <thead><tr>
                        <th>Name</th><th>Status</th><th>Type</th><th>Open</th><th>Close</th>
                        <th>Price Band</th><th>Lot</th><th>Source</th><th></th>
                    </tr></thead>
                    <tbody>
                        ${(Array.isArray(rows) ? rows : []).map(u => `<tr>
                            <td><strong>${u.ipo_name}</strong>${u.source_url ? `<br><a href="${u.source_url}" target="_blank" rel="noopener" style="font-size:0.75rem">View source</a>` : ''}</td>
                            <td>${statusBadge(u.ipo_status)}</td>
                            <td>${u.ipo_type || '-'}</td>
                            <td>${formatDate(u.bidding_open)}</td>
                            <td>${formatDate(u.bidding_close)}</td>
                            <td>${u.price_band_low != null ? u.price_band_low : '-'} – ${u.price_band_high != null ? u.price_band_high : '-'}</td>
                            <td>${u.lot_size || '-'}</td>
                            <td style="font-size:0.8rem">${u.source || '-'}</td>
                            <td><button class="btn btn-primary" onclick="importUpcomingIPO(${u.id})"><i class="fas fa-plus"></i> Add</button></td>
                        </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;padding:2rem">No IPOs yet. Click <strong>Fetch Live IPOs</strong> to pull from Moneycontrol.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.fetchLiveIPOs = async function () {
        showToast('Fetching live IPO data...', 'info');
        const res = await apiFetch(`${API_BASE}/upcoming-ipos/fetch-live`, { method: 'POST', body: {} });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadUpcomingIPOsView();
        } else {
            showToast(data.error || 'Fetch failed', 'error');
        }
    };

    window.importUpcomingIPO = async function (id) {
        const res = await apiFetch(`${API_BASE}/upcoming-ipos/${id}/import`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadView('ipos');
        } else {
            showToast(data.error || 'Failed', 'error');
        }
    };

    async function loadAuditView() {
        const contentArea = document.getElementById('content-area');
        const res = await apiFetch(`${API_BASE}/audit-logs`);
        const logs = await res.json();
        contentArea.innerHTML = `
            <div class="header-actions"><h1><i class="fas fa-history"></i> Audit Trail</h1></div>
            <div class="card table-container">
                <table class="data-table">
                    <thead><tr><th>Time</th><th>Entity</th><th>Field</th><th>Old</th><th>New</th></tr></thead>
                    <tbody>
                        ${logs.map(l => `<tr>
                            <td>${l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</td>
                            <td>${l.entity_type} #${l.entity_id}</td>
                            <td>${l.field_name}</td>
                            <td>${l.old_value || '-'}</td>
                            <td>${l.new_value || '-'}</td>
                        </tr>`).join('') || '<tr><td colspan="5">No audit entries yet</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function loadSettingsViewSaas() {
        const contentArea = document.getElementById('content-area');
        const session = getSession();
        const [limitsRes, billingRes, plansRes] = await Promise.all([
            apiFetch(`${API_BASE}/bank-limits`),
            apiFetch(`${API_BASE}/billing/status`),
            apiFetch(`${API_BASE}/billing/plans`),
        ]);
        const limits = await limitsRes.json();
        const billing = await billingRes.json();
        const plansData = await plansRes.json();
        const proPlan = (plansData.plans || []).find(p => p.id === 'pro');
        const isOwner = ['owner', 'admin'].includes(session?.role);

        contentArea.innerHTML = `
            <div class="header-actions"><h1><i class="fas fa-cog"></i> Settings</h1></div>
            <div class="card fo-panel" style="margin-bottom:1.5rem">
                <h2 style="color:var(--heading-color);margin-bottom:1rem">Workspace</h2>
                <p><strong>${session?.organization?.name || ''}</strong> <span class="org-badge">${billing.plan || 'free'}</span></p>
                <p style="margin-top:0.5rem">Role: ${session?.role || 'member'}</p>
                <p style="margin-top:0.5rem;font-size:0.85rem">Subscription: ${billing.subscription_status || 'none'}</p>
                <p style="margin-top:0.5rem;font-size:0.85rem">Usage: ${billing.usage?.investors || 0}/${billing.limits?.max_investors} investors · ${billing.usage?.ipos || 0}/${billing.limits?.max_ipos} IPOs</p>
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color)">
                    <h3 style="font-size:0.9rem;margin-bottom:0.75rem;color:var(--heading-color)">Create New Workspace</h3>
                    <form id="create-org-form" style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <input type="text" id="new-org-name" placeholder="Family Office 2026" required style="flex:1;min-width:180px">
                        <button type="submit" class="btn btn-primary">Create</button>
                    </form>
                </div>
                <div style="margin-top:1rem">
                    <button class="btn btn-secondary" onclick="sendAlertDigest()"><i class="fas fa-bell"></i> Send Closing IPO Alert</button>
                </div>
            </div>
            <div class="card" style="margin-bottom:1.5rem">
                <h2 style="color:var(--heading-color);margin-bottom:1rem"><i class="fas fa-credit-card"></i> Billing</h2>
                ${billing.plan === 'pro' ? `
                    <p style="margin-bottom:1rem">You are on <strong>Pro</strong>.</p>
                    ${isOwner && billing.stripe_enabled ? `<button class="btn btn-secondary" onclick="openBillingPortal()">Manage Subscription</button>` : ''}
                ` : `
                    <p style="margin-bottom:1rem">${proPlan?.price_label || 'Pro'} — unlimited investors & IPOs, full IPO control.</p>
                    ${isOwner && billing.stripe_enabled ? `<button class="btn btn-primary" onclick="startProCheckout()"><i class="fas fa-rocket"></i> Upgrade to Pro</button>` : `
                        <p style="font-size:0.85rem;opacity:0.8">Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO on the server.</p>
                    `}
                `}
            </div>
            <div class="card">
                <h2 style="color:var(--heading-color);margin-bottom:1rem">Bank ASBA Headroom Limits</h2>
                <form id="bank-limit-form" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem">
                    <input type="text" id="bl-bank" placeholder="Bank name" required style="flex:1;min-width:140px">
                    <input type="number" id="bl-cap" placeholder="Max blocked ₹" required style="width:160px">
                    <button type="submit" class="btn btn-primary">Save Limit</button>
                </form>
                <table class="data-table">
                    <thead><tr><th>Bank</th><th>Cap</th><th>Blocked</th><th>Remaining</th><th></th></tr></thead>
                    <tbody>
                        ${limits.map(l => `<tr>
                            <td>${l.bank_name}</td>
                            <td>${formatCurrency(l.max_blocked_amount)}</td>
                            <td>${formatCurrency(l.current_blocked)}</td>
                            <td>${l.remaining != null ? formatCurrency(l.remaining) : '—'}</td>
                            <td><button class="btn-icon delete" onclick="deleteBankLimit(${l.id})"><i class="fas fa-trash"></i></button></td>
                        </tr>`).join('') || '<tr><td colspan="5">No limits set — add caps to control ASBA blocking</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        const createOrgForm = document.getElementById('create-org-form');
        if (createOrgForm) {
            createOrgForm.onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('new-org-name').value.trim();
                const res = await apiFetch(`${API_BASE}/auth/create-org`, { method: 'POST', body: { name } });
                const data = await res.json();
                if (res.ok) {
                    saveSession(data);
                    updateUserProfileUI();
                    showToast(`Workspace "${name}" created`, 'success');
                    if (typeof initOrgSwitcher === 'function') initOrgSwitcher();
                    loadSettingsViewSaas();
                } else showToast(data.error || 'Failed', 'error');
            };
        }

        document.getElementById('bank-limit-form').onsubmit = async (e) => {
            e.preventDefault();
            await apiFetch(`${API_BASE}/bank-limits`, {
                method: 'POST',
                body: {
                    bank_name: document.getElementById('bl-bank').value,
                    max_blocked_amount: parseFloat(document.getElementById('bl-cap').value),
                },
            });
            showToast('Bank limit saved', 'success');
            loadSettingsViewSaas();
        };
    }

    window.startProCheckout = async function () {
        const res = await apiFetch(`${API_BASE}/billing/checkout`, { method: 'POST', body: {} });
        const data = await res.json();
        if (data.checkout_url) window.location.href = data.checkout_url;
        else showToast(data.error || 'Checkout failed', 'error');
    };

    window.openBillingPortal = async function () {
        const res = await apiFetch(`${API_BASE}/billing/portal`, { method: 'POST', body: {} });
        const data = await res.json();
        if (data.portal_url) window.location.href = data.portal_url;
        else showToast(data.error || 'Portal unavailable', 'error');
    };

    window.sendAlertDigest = async function () {
        const res = await apiFetch('/api/fo/alerts/send-digest', { method: 'POST', body: {} });
        const data = await res.json();
        showToast(data.message, res.ok ? 'success' : 'info');
    };

    window.deleteBankLimit = async function (id) {
        if (!confirm('Remove this bank limit?')) return;
        await apiFetch(`${API_BASE}/bank-limits/${id}`, { method: 'DELETE' });
        loadSettingsViewSaas();
    };

    window.openBulkAllotmentModal = function (ipoId, ipoName) {
        let modal = document.getElementById('bulk-allot-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bulk-allot-modal';
            modal.className = 'modal hidden';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-content" style="max-width:560px">
                <div class="modal-header">
                    <h2>Bulk Allotment — ${ipoName}</h2>
                    <button class="close" onclick="closeModal('bulk-allot-modal')"><i class="fas fa-times"></i></button>
                </div>
                <p style="margin-bottom:1rem;font-size:0.9rem">Upload Excel with columns: <strong>Investor Name, Status</strong> (optional: Allotted Shares)</p>
                <form id="bulk-allot-form">
                    <input type="hidden" id="bulk-ipo-id" value="${ipoId}">
                    <div class="form-group">
                        <label>Excel File</label>
                        <input type="file" id="bulk-allot-file" accept=".xlsx,.xls" required>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <button type="submit" class="btn btn-primary">Import Results</button>
                        <button type="button" class="btn btn-secondary" onclick="bulkMarkStatus(${ipoId}, 'Not Allotted')">Mark All Not Allotted</button>
                        <button type="button" class="btn btn-secondary" onclick="openListingDayModal(${ipoId}, '${ipoName.replace(/'/g, "\\'")}')">Listing Day Bulk</button>
                    </div>
                </form>
            </div>
        `;
        modal.classList.remove('hidden');
        document.getElementById('bulk-allot-form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.append('file', document.getElementById('bulk-allot-file').files[0]);
            fd.append('ipo_id', ipoId);
            const res = await apiFetch(`${API_BASE}/applications/bulk-import`, { method: 'POST', body: fd });
            const data = await res.json();
            showToast(data.message || (data.error || 'Done'), res.ok ? 'success' : 'error');
            if (res.ok) {
                closeModal('bulk-allot-modal');
                loadApplicationsView();
            }
        };
    };

    window.bulkMarkStatus = async function (ipoId, status) {
        if (!confirm(`Mark all applications for this IPO as "${status}"?`)) return;
        const res = await apiFetch(`${API_BASE}/applications/bulk-status`, {
            method: 'POST',
            body: { ipo_id: ipoId, status },
        });
        const data = await res.json();
        showToast(data.message, res.ok ? 'success' : 'error');
        loadApplicationsView();
    };

    window.openListingDayModal = function (ipoId, ipoName) {
        const sell = prompt(`Listing day sell price for ${ipoName}:`, '');
        if (sell === null) return;
        apiFetch(`${API_BASE}/applications/listing-day`, {
            method: 'POST',
            body: { ipo_id: ipoId, sell_price: parseFloat(sell), payment_status: 'Received' },
        }).then(res => res.json()).then(data => {
            showToast(data.message, 'success');
            loadApplicationsView();
        });
    };

    window.exportApplications = async function (ipoId) {
        const q = ipoId ? `?ipo_id=${ipoId}` : '';
        const res = await apiFetch(`${API_BASE}/applications/export${q}`);
        if (!res.ok) {
            showToast('Export failed', 'error');
            return;
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ipo_applications.xlsx';
        a.click();
    };

    function patchIPOModal() {
        const orig = window.addIPOModal;
        if (!orig) return;
        window.addIPOModal = function () {
            orig();
            const form = document.getElementById('ipo-form');
            if (!form || document.getElementById('ipo-lifecycle')) return;
            if (document.getElementById('ipo-lifecycle')) return;
            const row = document.createElement('div');
            row.innerHTML = `
                <div class="form-row" style="margin-top:1rem">
                    <div class="form-group">
                        <label>Lifecycle Stage</label>
                        <select id="ipo-lifecycle">
                            <option>Upcoming</option><option>Open</option><option>BiddingClosed</option>
                            <option>AwaitingAllotment</option><option>Listed</option><option>Closed</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Bidding Close</label><input type="date" id="ipo-bidding-close"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Allotment Date</label><input type="date" id="ipo-allotment-date"></div>
                    <div class="form-group"><label>Lot Size</label><input type="number" id="ipo-lot-size"></div>
                </div>
            `;
            form.insertBefore(row, form.querySelector('button'));
            const submit = form.onsubmit;
            form.addEventListener('submit', function patchSubmit(e) {
                // handled in ipo form patch below
            }, true);
        };
        patchIPOSubmit();
    }

    function patchIPOSubmit() {
        document.addEventListener('submit', async function (e) {
            if (e.target.id !== 'ipo-form') return;
            const lc = document.getElementById('ipo-lifecycle');
            if (!lc) return;
            e.stopImmediatePropagation();
            e.preventDefault();
            const id = document.getElementById('ipo-id').value;
            const data = {
                ipo_name: document.getElementById('ipo-name').value,
                ipo_type: document.getElementById('ipo-type').value,
                status: document.getElementById('ipo-status').value,
                lifecycle_stage: lc.value,
                ipo_date: document.getElementById('ipo-date').value,
                bidding_close_date: document.getElementById('ipo-bidding-close')?.value,
                allotment_date: document.getElementById('ipo-allotment-date')?.value,
                listing_date: document.getElementById('ipo-listing-date').value,
                num_shares: parseInt(document.getElementById('ipo-shares').value),
                lot_size: parseInt(document.getElementById('ipo-lot-size')?.value) || undefined,
                purchase_price_per_share: parseFloat(document.getElementById('ipo-buy-price').value),
                sale_price_per_share: document.getElementById('ipo-sell-price').value ? parseFloat(document.getElementById('ipo-sell-price').value) : null,
            };
            const url = id ? `${API_BASE}/ipos/${id}` : `${API_BASE}/ipos`;
            await apiFetch(url, { method: id ? 'PUT' : 'POST', body: data });
            closeModal('ipo-modal');
            loadIPOsView();
        }, true);
    }

    function patchApplicationModal() {
        const orig = window.addApplicationModal;
        if (!orig) return;
        window.addApplicationModal = function () {
            orig();
            const form = document.getElementById('application-form');
            if (!form || document.getElementById('app-ref')) return;
        };
    }

    // Inject bulk/export buttons into applications view after load
    const origApps = window.loadApplicationsView;
    if (origApps) {
        window.loadApplicationsView = async function () {
            await origApps();
            document.querySelectorAll('.ipo-group-header, .header-actions h1').forEach(() => {});
            setTimeout(() => {
                const header = document.querySelector('#content-area .header-actions');
                if (header && !document.getElementById('export-all-btn')) {
                    const btns = document.createElement('div');
                    btns.innerHTML = `
                        <button id="export-all-btn" class="btn btn-secondary" onclick="exportApplications()"><i class="fas fa-download"></i> Export Excel</button>
                    `;
                    header.appendChild(btns.firstElementChild);
                }
                document.querySelectorAll('[data-ipo-id-for-bulk]').forEach(() => {});
            }, 100);
        };
    }

    const origReports = window.loadReportsView;
    if (origReports) {
        window.loadReportsView = async function () {
            await origReports();
            const res = await apiFetch(`${API_BASE}/scorecard`);
            const cards = await res.json();
            const area = document.getElementById('content-area');
            const block = document.createElement('div');
            block.className = 'card';
            block.style.marginTop = '1.5rem';
            block.innerHTML = `
                <h2 style="margin-bottom:1rem;color:var(--heading-color)">IPO Scorecard</h2>
                <table class="data-table">
                    <thead><tr><th>IPO</th><th>Stage</th><th>Applied</th><th>Allotted</th><th>Hit %</th><th>Profit</th><th>Blocked</th></tr></thead>
                    <tbody>${cards.map(c => `<tr>
                        <td>${c.ipo_name}</td><td>${c.lifecycle_stage}</td>
                        <td>${c.applied}</td><td>${c.allotted}</td><td>${c.hit_rate_pct}%</td>
                        <td>${formatCurrency(c.profit)}</td><td>${formatCurrency(c.blocked_amount)}</td>
                    </tr>`).join('') || '<tr><td colspan="7">No IPOs</td></tr>'}</tbody>
                </table>`;
            area.appendChild(block);
        };
    }

    window.enhanceIPOCardActions = function (ipoId, ipoName) {
        return `
            <button class="btn btn-secondary" onclick="openBulkAllotmentModal(${ipoId}, '${String(ipoName).replace(/'/g, "\\'")}')"><i class="fas fa-tasks"></i> Bulk Results</button>
            <button class="btn btn-secondary" onclick="exportApplications(${ipoId})"><i class="fas fa-download"></i> Export</button>
        `;
    };
})();
