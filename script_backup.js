// Global state
let investors = [];
let ipos = [];
let applications = [];

// API Base URL
const API_BASE = 'http://127.0.0.1:5001/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded');
    setupNavigation();
    setupThemeToggle();
    setupSidebarToggle();

    // Load default view
    setTimeout(() => {
        console.log('Loading default view');
        loadView('dashboard');
    }, 100);
});

// Navigation Handling
function setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar nav li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            const view = item.dataset.view;
            loadView(view);
        });
    });
}

// Theme Toggle
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });
}

// Sidebar Toggle
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = sidebarToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }
        });
    }
}

// Load View
function loadView(view) {
    const contentArea = document.getElementById('content-area');

    if (view === 'dashboard') {
        loadDashboardView();
    } else if (view === 'investors') {
        loadInvestorsView();
    } else if (view === 'ipos') {
        loadIPOsView();
    } else if (view === 'applications') {
        loadApplicationsView();
    } else if (view === 'investor-wise') {
        loadInvestorWiseView();
    } else if (view === 'bank-wise') {
        loadBankWiseView();
    } else if (view === 'money-transfers') {
        loadMoneyTransfersView();
    } else if (view === 'reports') {
        loadReportsView();
    } else if (view === 'settings') {
        loadSettingsView();
    } else {
        contentArea.innerHTML = `<h1>${view.charAt(0).toUpperCase() + view.slice(1)} View</h1><p>Coming Soon...</p>`;
    }
}

// Dashboard View
async function loadDashboardView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const [summaryRes, fundingRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard/summary`),
            fetch(`${API_BASE}/reports/funding-summary`)
        ]);

        const summary = await summaryRes.json();
        const funding = await fundingRes.json();

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Dashboard Overview</h1>
                <div>
                    <button class="btn btn-secondary" onclick="loadView('money-transfers')">
                        <i class="fas fa-exchange-alt"></i> Money Transfers
                    </button>
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-wallet"></i></div>
                    <div class="stat-value">${formatCurrency(summary.total_invested)}</div>
                    <div class="stat-label">Total Invested</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-value" style="color: ${summary.total_profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">${formatCurrency(summary.total_profit)}</div>
                    <div class="stat-label">Total Profit</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-lock"></i></div>
                    <div class="stat-value">${formatCurrency(summary.amount_blocked)}</div>
                    <div class="stat-label">Amount Blocked</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    <div class="stat-value" style="color: var(--warning-color);">${formatCurrency(funding.borrowed_amount_pending_repayment || 0)}</div>
                    <div class="stat-label">Borrowed (Pending)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-value">${summary.total_applications}</div>
                    <div class="stat-label">Total Applications</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-value">${summary.total_allotted}</div>
                    <div class="stat-label">Allotted</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${summary.total_applied}</div>
                    <div class="stat-label">Applied</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-value">${summary.total_not_allotted}</div>
                    <div class="stat-label">Not Allotted</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
                <div class="card">
                    <h2 style="margin-bottom: 20px;">💰 Funding Sources</h2>
                    <div id="funding-breakdown"></div>
                </div>
                
                <div class="card">
                    <h2 style="margin-bottom: 20px;">🏦 Money Flow Summary</h2>
                    <div style="display: grid; gap: 16px;">
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid var(--warning-color);">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">💸 Money Lent (Pending Return)</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--warning-color);">${formatCurrency(funding.money_lent_pending_return || 0)}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">${funding.pending_transfers_count || 0} pending transfers</div>
                        </div>
                        
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid var(--danger-color);">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">📋 Borrowed Applications</div>
                            <div style="font-size: 1.3rem; font-weight: 600; color: var(--danger-color);">${funding.borrowed_applications_count || 0}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">applications using borrowed money</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 24px;">
                <h2 style="margin-bottom: 20px;">📊 IPO-wise Performance</h2>
                <div id="ipo-performance-chart"></div>
            </div>
        `;

        // Load funding breakdown
        loadFundingBreakdown(funding.funding_breakdown || []);

        // Load IPO performance widget
        loadIPOPerformanceWidget();
    } catch (error) {
        console.error('Error loading dashboard:', error);
        contentArea.innerHTML = '<h1>Error loading dashboard</h1>';
    }
}

// Load Funding Breakdown
function loadFundingBreakdown(fundingData) {
    const container = document.getElementById('funding-breakdown');
    if (!container || fundingData.length === 0) {
        if (container) {
            container.innerHTML = '<p style="color: var(--text-color); opacity: 0.7; text-align: center; padding: 20px;">No funding data available.</p>';
        }
        return;
    }

    const totalAmount = fundingData.reduce((sum, item) => sum + item.amount, 0);

    container.innerHTML = `
        <div style="display: grid; gap: 12px;">
            ${fundingData.map(item => {
        const percentage = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : 0;
        const color = item.source === 'Own' ? 'var(--success-color)' :
            item.source === 'Borrowed' ? 'var(--danger-color)' :
                'var(--primary-color)';
        const icon = item.source === 'Own' ? '💰' :
            item.source === 'Borrowed' ? '🤝' :
                '📱';

        return `
                    <div style="padding: 12px; background: var(--bg-color); border-radius: 6px; border-left: 3px solid ${color};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 4px;">${icon} ${item.source}</div>
                                <div style="font-size: 0.85rem; opacity: 0.7;">${item.count} applications</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: ${color};">${formatCurrency(item.amount)}</div>
                                <div style="font-size: 0.8rem; opacity: 0.6;">${percentage}%</div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// Load IPO Performance Widget
async function loadIPOPerformanceWidget() {
    try {
        const [ipoRes, appRes] = await Promise.all([
            fetch(`${API_BASE}/ipos`),
            fetch(`${API_BASE}/applications`)
        ]);

        const ipos = await ipoRes.json();
        const applications = await appRes.json();

        // Group and calculate stats
        const ipoStats = ipos.map(ipo => {
            const ipoApps = applications.filter(app => app.ipo_id === ipo.id);
            const allotted = ipoApps.filter(app => app.status === 'Allotted');
            const totalInvested = ipoApps.reduce((sum, app) => sum + (app.application_amount || 0), 0);
            const totalProfit = allotted.reduce((sum, app) => sum + (app.profit || 0), 0);

            return {
                name: ipo.ipo_name,
                applications: ipoApps.length,
                allotted: allotted.length,
                invested: totalInvested,
                profit: totalProfit,
                profitPercent: totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(1) : 0
            };
        }).filter(stat => stat.applications > 0)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);

        const container = document.getElementById('ipo-performance-chart');
        if (container && ipoStats.length > 0) {
            container.innerHTML = `
                <div style="display: grid; gap: 16px;">
                    ${ipoStats.map(stat => `
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid ${stat.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <strong style="font-size: 1.05rem;">${stat.name}</strong>
                                <span style="font-size: 1.1rem; font-weight: 600; color: ${stat.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                    ${formatCurrency(stat.profit)} (${stat.profitPercent > 0 ? '+' : ''}${stat.profitPercent}%)
                                </span>
                            </div>
                            <div style="display: flex; gap: 20px; font-size: 0.9rem; color: var(--text-color); opacity: 0.8;">
                                <span><i class="fas fa-file-alt"></i> ${stat.applications} Apps</span>
                                <span><i class="fas fa-check-circle"></i> ${stat.allotted} Allotted</span>
                                <span><i class="fas fa-wallet"></i> ${formatCurrency(stat.invested)} Invested</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (container) {
            container.innerHTML = '<p style="color: var(--text-color); opacity: 0.7; text-align: center; padding: 20px;">No IPO data available yet.</p>';
        }
    } catch (error) {
        console.error('Error loading IPO performance:', error);
    }
}

// Investors View
async function loadInvestorsView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const response = await fetch(`${API_BASE}/investors`);
        investors = await response.json();

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Investor Management</h1>
                <div>
                    <button class="btn btn-secondary" onclick="openImportModal()">
                        <i class="fas fa-upload"></i> Import Excel
                    </button>
                    <button class="btn btn-primary" onclick="openInvestorModal()">
                        <i class="fas fa-plus"></i> Add Investor
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>UPI ID</th>
                            <th>Family Group</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${investors.map(inv => `
                            <tr>
                                <td><strong>${inv.name}</strong></td>
                                <td>${inv.upi || '-'}</td>
                                <td><span class="status-badge">${inv.family_group}</span></td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-icon" onclick="editInvestor(${inv.id})" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon delete" onclick="deleteInvestor(${inv.id})" title="Delete">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Add modals
        addInvestorModal();
        addImportModal();
    } catch (error) {
        console.error('Error loading investors:', error);
    }
}

// IPOs View
async function loadIPOsView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const response = await fetch(`${API_BASE}/ipos`);
        ipos = await response.json();

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>IPO Management</h1>
                <button class="btn btn-primary" onclick="openIPOModal()">
                    <i class="fas fa-plus"></i> Add IPO
                </button>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>IPO Name</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Shares</th>
                            <th>Buy Price</th>
                            <th>Sell Price</th>
                            <th>Profit</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ipos.map(ipo => `
                            <tr>
                                <td>
                                    <strong>${ipo.ipo_name}</strong><br>
                                    <small style="color: var(--text-color); opacity: 0.7;">${formatDate(ipo.ipo_date)}</small>
                                </td>
                                <td><span class="status-badge">${ipo.ipo_type || 'Mainboard'}</span></td>
                                <td><span class="status-badge ${ipo.status === 'Open' ? 'allotted' : 'pending'}">${ipo.status || 'Open'}</span></td>
                                <td>${ipo.num_shares}</td>
                                <td>${formatCurrency(ipo.purchase_price_per_share)}</td>
                                <td>${ipo.sale_price_per_share ? formatCurrency(ipo.sale_price_per_share) : '-'}</td>
                                <td style="color: ${ipo.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">
                                    ${formatCurrency(ipo.profit)}
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-icon" onclick="openBulkApplyModal(${ipo.id})" title="Bulk Apply" style="color: var(--primary-color);">
                                            <i class="fas fa-users"></i>
                                        </button>
                                        <button class="btn-icon" onclick="editIPO(${ipo.id})" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon delete" onclick="deleteIPO(${ipo.id})" title="Delete">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        addIPOModal();
        addBulkApplyModal();
    } catch (error) {
        console.error('Error loading IPOs:', error);
    }
}

function addBulkApplyModal() {
    if (document.getElementById('bulk-apply-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'bulk-apply-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Bulk Apply</h2>
                <button class="close" onclick="closeModal('bulk-apply-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="bulk-apply-form">
                <input type="hidden" id="bulk-ipo-id">
                <div class="form-group">
                    <label>IPO Name</label>
                    <input type="text" id="bulk-ipo-name" readonly style="background: var(--bg-color); opacity: 0.7;">
                </div>
                
                <div class="form-group">
                    <label>Select Investors</label>
                    <div class="bulk-actions">
                        <button type="button" class="btn btn-secondary" onclick="selectAllInvestors(true)">Select All</button>
                        <button type="button" class="btn btn-secondary" onclick="selectAllInvestors(false)">Deselect All</button>
                    </div>
                    <div class="checkbox-list" id="investor-checkbox-list">
                        <!-- Checkboxes will be populated here -->
                    </div>
                </div>

                <div class="form-group">
                    <label>Application Amount (per investor) *</label>
                    <input type="number" step="0.01" id="bulk-amount" required>
                </div>
                
                <div class="form-group">
                    <label>Bank Name (Optional - applies to all)</label>
                    <input type="text" id="bulk-bank" placeholder="e.g. HDFC Bank">
                </div>

                <button type="submit" class="btn btn-primary">Apply for Selected</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('bulk-apply-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ipoId = document.getElementById('bulk-ipo-id').value;
        const amount = parseFloat(document.getElementById('bulk-amount').value);
        const bankName = document.getElementById('bulk-bank').value;

        const checkboxes = document.querySelectorAll('#investor-checkbox-list input[type="checkbox"]:checked');
        const selectedInvestorIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedInvestorIds.length === 0) {
            alert('Please select at least one investor.');
            return;
        }

        if (confirm(`Are you sure you want to apply for ${selectedInvestorIds.length} investors?`)) {
            let successCount = 0;

            for (const investorId of selectedInvestorIds) {
                try {
                    await fetch(`${API_BASE}/applications`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            investor_id: parseInt(investorId),
                            ipo_id: parseInt(ipoId),
                            application_amount: amount,
                            status: 'Applied',
                            payment_status: 'Pending',
                            bank_name: bankName
                        })
                    });
                    successCount++;
                } catch (error) {
                    console.error('Error applying for investor ' + investorId, error);
                }
            }

            alert(`Successfully applied for ${successCount} investors.`);
            closeModal('bulk-apply-modal');
            loadApplicationsView(); // Switch to applications view to see results
        }
    });
}

async function openBulkApplyModal(ipoId) {
    const ipo = ipos.find(i => i.id === ipoId);
    if (!ipo) return;

    // Ensure investors are loaded
    if (investors.length === 0) {
        const response = await fetch(`${API_BASE}/investors`);
        investors = await response.json();
    }

    document.getElementById('bulk-ipo-id').value = ipo.id;
    document.getElementById('bulk-ipo-name').value = ipo.ipo_name;
    document.getElementById('bulk-amount').value = ipo.purchase_price_per_share * ipo.num_shares; // Default amount
    document.getElementById('bulk-bank').value = '';

    const listContainer = document.getElementById('investor-checkbox-list');
    listContainer.innerHTML = investors.map(inv => `
        <div class="checkbox-item">
        <input type="checkbox" id="inv-${inv.id}" value="${inv.id}">
            <label for="inv-${inv.id}">${inv.name} <small style="opacity: 0.7;">(${inv.family_group})</small></label>
        </div>
    `).join('');

    document.getElementById('bulk-apply-modal').classList.remove('hidden');
}

function selectAllInvestors(select) {
    const checkboxes = document.querySelectorAll('#investor-checkbox-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = select);
}

// Data Grouping and Summary Functions

/**
 * Groups applications by IPO ID
 * @param {Array} applications - Array of application objects
 * @param {Array} ipos - Array of IPO objects
 * @returns {Map} Map of IPO ID to {ipo, applications} objects
 */
function groupApplicationsByIPO(applications, ipos) {
    const groups = new Map();

    // Create IPO lookup for quick access
    const ipoMap = new Map(ipos.map(ipo => [ipo.id, ipo]));

    // Group applications by IPO
    applications.forEach(app => {
        if (!app.ipo_id) return; // Skip invalid applications

        if (!groups.has(app.ipo_id)) {
            const ipo = ipoMap.get(app.ipo_id);
            if (ipo) {
                groups.set(app.ipo_id, {
                    ipo: ipo,
                    applications: []
                });
            }
        }

        if (groups.has(app.ipo_id)) {
            groups.get(app.ipo_id).applications.push(app);
        }
    });

    return groups;
}

/**
 * Calculates summary statistics for a group of applications
 * @param {Array} applications - Array of application objects for a specific IPO
 * @returns {Object} Summary object with counts and totals
 */
function calculateIPOSummary(applications) {
    const summary = {
        totalApplications: applications.length,
        appliedCount: 0,
        allottedCount: 0,
        notAllottedCount: 0,
        totalInvested: 0,
        totalProfit: 0
    };

    applications.forEach(app => {
        // Count by status
        if (app.status === 'Applied') {
            summary.appliedCount++;
        } else if (app.status === 'Allotted') {
            summary.allottedCount++;
        } else if (app.status === 'Not Allotted') {
            summary.notAllottedCount++;
        }

        // Sum invested amount
        summary.totalInvested += app.application_amount || 0;

        // Sum profit only for allotted applications
        if (app.status === 'Allotted') {
            summary.totalProfit += app.profit || 0;
        }
    });

    return summary;
}

// Applications View
async function loadApplicationsView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const [invRes, ipoRes, appRes] = await Promise.all([
            fetch(`${API_BASE}/investors`),
            fetch(`${API_BASE}/ipos`),
            fetch(`${API_BASE}/applications`)
        ]);

        investors = await invRes.json();
        ipos = await ipoRes.json();
        applications = await appRes.json();

        // Handle edge case: no IPOs
        if (ipos.length === 0) {
            contentArea.innerHTML = `
                <div class="header-actions">
                    <h1>Application Tracking</h1>
                </div>
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-building" style="font-size: 48px; color: var(--text-color); opacity: 0.3; margin-bottom: 16px;"></i>
                    <p style="color: var(--text-color); font-size: 1.1rem;">No IPOs found. Please add IPOs first.</p>
                </div>
            `;
            return;
        }

        // Handle edge case: no investors
        if (investors.length === 0) {
            contentArea.innerHTML = `
                <div class="header-actions">
                    <h1>Application Tracking</h1>
                </div>
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 48px; color: var(--text-color); opacity: 0.3; margin-bottom: 16px;"></i>
                    <p style="color: var(--text-color); font-size: 1.1rem;">No investors found. Please add investors first.</p>
                </div>
            `;
            return;
        }

        // Create IPO groups with ALL investors
        let ipoGroupsHTML = '';

        ipos.forEach(ipo => {
            // Smart Filtering: If IPO is Closed, only show Allotted applications
            // If IPO is Open/Upcoming, show all investors (to allow applying)
            const isClosed = ipo.status === 'Closed';

            // Get existing applications for this IPO
            const existingApps = applications.filter(app => app.ipo_id === ipo.id);
            const existingAppMap = new Map(existingApps.map(app => [app.investor_id, app]));

            // Create rows
            let rows = '';

            if (isClosed) {
                // For Closed IPOs: Iterate over EXISTING applications only, and filter for 'Allotted'
                // User requirement: "just want to have details of alloted"
                const allottedApps = existingApps.filter(app => app.status === 'Allotted');

                if (allottedApps.length === 0) {
                    rows = '<tr><td colspan="9" style="text-align: center; color: var(--text-color); opacity: 0.6; padding: 20px;">No allotted applications for this closed IPO.</td></tr>';
                } else {
                    rows = allottedApps.map(app => {
                        const investor = investors.find(inv => inv.id === app.investor_id);
                        if (!investor) return '';

                        const profitIcon = app.profit > 0 ? '📈' : app.profit < 0 ? '📉' : '➖';
                        const borderColor = 'var(--success-color)';

                        // Create bank options for inline select
                        const investorBanks = investor.banks ? investor.banks.split(',').map(b => b.trim()) : [];
                        let bankOptions = investorBanks.map(bank =>
                            `<option value="${bank}" ${bank === app.bank_name ? 'selected' : ''}>${bank}</option>`
                        ).join('');
                        // Add an option for the current bank if it's not in the list (data integrity)
                        if (app.bank_name && !investorBanks.includes(app.bank_name)) {
                            bankOptions += `<option value="${app.bank_name}" selected>${app.bank_name}</option>`;
                        }

                        // Bank Select HTML
                        const bankSelect = `
                            <select class="inline-select" onchange="updateApplicationField(${app.id}, 'bank_name', this.value)">
                                <option value="">Select Bank</option>
                                ${bankOptions}
                            </select>
                        `;

                        return `
                            <tr style="border-left: 3px solid ${borderColor};">
                                <td style="width: 40px; text-align: center;">
                                    <input type="checkbox" class="app-checkbox-${ipo.id}" onchange="toggleRowSelection(this)" data-id="${app.id}">
                                </td>
                                <td><strong>${investor.name}</strong> <span style="font-size: 0.75rem; opacity: 0.6;">(${investor.family_group || 'N/A'})</span></td>
                                <td>
                                    <input type="number"
                                           class="inline-select"
                                           style="width: 100px; border: 1px solid var(--border-color);"
                                           placeholder="Sell Price"
                                           value="${app.sell_price || ''}"
                                           onchange="updateApplicationField(${app.id}, 'sell_price', this.value)">
                                </td>
                                <td>${formatCurrency(app.application_amount)}</td>
                                <td style="width: 200px;">${bankSelect}</td>
                                <td><span class="status-badge allotted">✅ Allotted</span></td>
                                <td><span class="status-badge ${app.payment_status.toLowerCase()}">${app.payment_status === 'Received' ? '💰' : '⏱️'} ${app.payment_status}</span></td>
                                <td style="color: ${app.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">${profitIcon} ${formatCurrency(app.profit)}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-icon" onclick="editApplication(${app.id})" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="btn-icon delete" onclick="deleteApplication(${app.id})" title="Delete"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } else {
                // For Open/Upcoming IPOs: Show ALL investors (standard view)
                rows = investors.map(investor => {
                    const existingApp = existingAppMap.get(investor.id);

                    if (existingApp) {
                        // Show existing application with INLINE EDITING
                        const profitIcon = existingApp.profit > 0 ? '📈' : existingApp.profit < 0 ? '📉' : '➖';
                        // Status Logic
                        const statusClass = existingApp.status === 'Allotted' ? 'status-allotted' : existingApp.status === 'Not Allotted' ? 'status-not-allotted' : 'status-applied';
                        const borderColor = existingApp.status === 'Allotted' ? 'var(--success-color)' : existingApp.status === 'Not Allotted' ? 'var(--danger-color)' : 'var(--warning-color)';

                        // Bank Select
                        const investorBanks = investor.banks ? investor.banks.split(',').map(b => b.trim()) : [];
                        let bankOptions = investorBanks.map(bank =>
                            `<option value="${bank}" ${bank === existingApp.bank_name ? 'selected' : ''}>${bank}</option>`
                        ).join('');
                        if (existingApp.bank_name && !investorBanks.includes(existingApp.bank_name)) {
                            bankOptions += `<option value="${existingApp.bank_name}" selected>${existingApp.bank_name}</option>`;
                        }
                        const bankSelect = `
                            <select class="inline-select" onchange="updateApplicationField(${existingApp.id}, 'bank_name', this.value)">
                                <option value="">Select Bank</option>
                                ${bankOptions}
                            </select>
                        `;

                        // Status Select
                        const statusSelect = `
                            <select class="inline-select ${statusClass}" onchange="updateApplicationField(${existingApp.id}, 'status', this.value)">
                                <option value="Applied" ${existingApp.status === 'Applied' ? 'selected' : ''}>Applied</option>
                                <option value="Allotted" ${existingApp.status === 'Allotted' ? 'selected' : ''}>Allotted</option>
                                <option value="Not Allotted" ${existingApp.status === 'Not Allotted' ? 'selected' : ''}>Not Allotted</option>
                            </select>
                        `;

                        // Payment Status Select
                        const paymentClass = existingApp.payment_status === 'Received' ? 'status-allotted' : 'status-applied';
                        const paymentSelect = `
                            <select class="inline-select ${paymentClass}" onchange="updateApplicationField(${existingApp.id}, 'payment_status', this.value)" ${existingApp.status !== 'Allotted' ? 'disabled style="opacity:0.5"' : ''}>
                                <option value="Pending" ${existingApp.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Received" ${existingApp.payment_status === 'Received' ? 'selected' : ''}>Received</option>
                            </select>
                        `;

                        return `
                            <tr style="border-left: 3px solid ${borderColor};">
                                <td style="width: 40px; text-align: center;">
                                    <input type="checkbox" class="app-checkbox-${ipo.id}" onchange="toggleRowSelection(this)" data-id="${existingApp.id}">
                                </td>
                                <td><strong>${investor.name}</strong> <span style="font-size: 0.75rem; opacity: 0.6;">(${investor.family_group || 'N/A'})</span></td>
                                <td>
                                    ${existingApp.status === 'Allotted' ?
                                `<input type="number" class="inline-select" style="width: 80px; border: 1px solid var(--border-color);" placeholder="Price" value="${existingApp.sell_price || ''}" onchange="updateApplicationField(${existingApp.id}, 'sell_price', this.value)">`
                                : '-'}
                                </td>
                                <td>${formatCurrency(existingApp.application_amount)}</td>
                                <td style="width: 180px;">${bankSelect}</td>
                                <td style="width: 130px;">${statusSelect}</td>
                                <td style="width: 110px;">${paymentSelect}</td>
                                <td style="color: ${existingApp.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">${profitIcon} ${formatCurrency(existingApp.profit)}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-icon" onclick="editApplication(${existingApp.id})" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="btn-icon delete" onclick="deleteApplication(${existingApp.id})" title="Delete"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        // Show "Not Applied" with Apply button (only if IPO is NOT closed, or maybe just hidden if closed? Logic above handles closed)
                        const amount = ipo.num_shares * ipo.purchase_price_per_share;
                        const upi = investor.upi || '';

                        return `
                            <tr style="border-left: 3px solid #ccc; opacity: 0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                                <td style="width: 40px; text-align: center;">-</td>
                                <td><strong>${investor.name}</strong> <span style="font-size: 0.75rem; opacity: 0.6;">(${investor.family_group || 'N/A'})</span></td>
                                <td>-</td>
                                <td>${formatCurrency(amount)}</td>
                                <td style="font-family: monospace; font-size: 0.9rem;">${upi || '-'}</td>
                                <td colspan="3">
                                    <button class="btn btn-primary" onclick="quickApply(${investor.id}, ${ipo.id}, ${amount}, '${upi}')" style="padding: 4px 12px; font-size: 0.85rem;">
                                        <i class="fas fa-check"></i> Apply
                                    </button>
                                </td>
                                <td style="opacity: 0.5;">-</td>
                            </tr>
                        `;
                    }
                }).join('');
            }

            // Calculate summary for this IPO using helper function
            const summary = calculateIPOSummary(existingApps);
            const ipoApps = summary.totalApplications;
            const applied = summary.appliedCount;
            const allotted = summary.allottedCount;
            const totalInvested = summary.totalInvested;
            const totalProfit = summary.totalProfit;

            ipoGroupsHTML += `
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h2 style="margin: 0 0 8px 0;">
                                ${ipo.ipo_name} 
                                ${isClosed ? '<span style="font-size: 0.8rem; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; vertical-align: middle;">Closed</span>' : ''}
                            </h2>
                            <div style="display: flex; gap: 16px; font-size: 0.9rem;">
                                ${isClosed ?
                    `<span style="color: var(--success-color);"><i class="fas fa-trophy"></i> ${allotted} Allotted</span>` :
                    `<span><i class="fas fa-users"></i> ${investors.length} Investors</span>
                                     <span style="color: var(--success-color);"><i class="fas fa-check-circle"></i> ${ipoApps} Applied</span>
                                     <span style="color: var(--success-color);"><i class="fas fa-trophy"></i> ${allotted} Allotted</span>`
                }
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="text-align: right;">
                                <div style="font-size: 0.85rem; opacity: 0.7;">Total Invested</div>
                                <div style="font-size: 1.3rem; font-weight: 600;">${formatCurrency(totalInvested)}</div>
                                <div style="font-size: 0.85rem; color: ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">Profit: ${formatCurrency(totalProfit)}</div>
                            </div>
                            <div class="bulk-actions" id="bulk-actions-${ipo.id}" style="display:none; gap: 8px;">
                                <button class="btn btn-secondary" onclick="bulkDelete('app-checkbox-${ipo.id}')" title="Delete Selected"><i class="fas fa-trash"></i></button>
                                <button class="btn btn-secondary" onclick="bulkUpdateStatus('app-checkbox-${ipo.id}', 'Allotted')" title="Mark Allotted">Allot</button>
                                <button class="btn btn-secondary" onclick="bulkUpdateStatus('app-checkbox-${ipo.id}', 'Not Allotted')" title="Mark Not Allotted">Not Allot</button>
                            </div>
                            <button class="btn btn-primary" onclick="openApplicationModal(${ipo.id})" title="Add application for this IPO">
                                <i class="fas fa-plus"></i> Add Application
                            </button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;"><input type="checkbox" onchange="toggleAll(this, 'app-checkbox-${ipo.id}')"></th>
                                    <th>Investor</th>
                                    <th>Sell Price</th>
                                    <th>Amount</th>
                                    <th>Bank / UPI</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Profit</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Application Tracking - IPO Wise</h1>
            </div>
            ${ipoGroupsHTML}
        `;

        addApplicationModal();
    } catch (error) {
        console.error('Error loading applications:', error);
        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Application Tracking</h1>
            </div>
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger-color); opacity: 0.5; margin-bottom: 16px;"></i>
                <h2 style="color: var(--danger-color); margin-bottom: 8px;">Error Loading Applications</h2>
                <p style="color: var(--text-color); opacity: 0.8;">Unable to load application data. Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadApplicationsView()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Investor-wise View
async function loadInvestorWiseView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const [invRes, ipoRes, appRes] = await Promise.all([
            fetch(`${API_BASE}/investors`),
            fetch(`${API_BASE}/ipos`),
            fetch(`${API_BASE}/applications`)
        ]);

        investors = await invRes.json();
        ipos = await ipoRes.json();
        applications = await appRes.json();

        // Handle edge cases
        if (investors.length === 0) {
            contentArea.innerHTML = `
                <div class="header-actions">
                    <h1>Investor-wise Analysis</h1>
                </div>
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 48px; color: var(--text-color); opacity: 0.3; margin-bottom: 16px;"></i>
                    <p style="color: var(--text-color); font-size: 1.1rem;">No investors found. Please add investors first.</p>
                </div>
            `;
            return;
        }

        // Create investor groups
        let investorGroupsHTML = '';

        investors.forEach(investor => {
            // Get applications for this investor
            const investorApps = applications.filter(app => app.investor_id === investor.id);

            if (investorApps.length === 0) {
                return; // Skip investors with no applications
            }

            // Calculate summary statistics
            const totalApplications = investorApps.length;
            const appliedCount = investorApps.filter(app => app.status === 'Applied').length;
            const allottedCount = investorApps.filter(app => app.status === 'Allotted').length;
            const notAllottedCount = investorApps.filter(app => app.status === 'Not Allotted').length;
            const totalInvested = investorApps.reduce((sum, app) => sum + (app.application_amount || 0), 0);
            const totalProfit = investorApps
                .filter(app => app.status === 'Allotted')
                .reduce((sum, app) => sum + (app.profit || 0), 0);
            const amountBlocked = investorApps
                .filter(app => app.status === 'Applied')
                .reduce((sum, app) => sum + (app.application_amount || 0), 0);

            // Get unique banks used
            const banksUsed = [...new Set(investorApps.map(app => app.bank_name).filter(b => b))];

            // Create rows for each application
            const rows = investorApps.map(app => {
                const ipo = ipos.find(i => i.id === app.ipo_id);
                const profitIcon = app.profit > 0 ? '📈' : app.profit < 0 ? '📉' : '➖';
                const statusIcon = app.status === 'Allotted' ? '✅' : app.status === 'Applied' ? '⏳' : '❌';
                const borderColor = app.status === 'Allotted' ? 'var(--success-color)' : app.status === 'Not Allotted' ? 'var(--danger-color)' : 'var(--warning-color)';

                return `
                    <tr style="border-left: 3px solid ${borderColor};">
                        <td><strong>${ipo ? ipo.ipo_name : 'Unknown IPO'}</strong></td>
                        <td>${formatCurrency(app.application_amount)}</td>
                        <td style="font-family: monospace; font-size: 0.9rem;">${app.bank_name || '-'}</td>
                        <td><span class="status-badge ${app.status.toLowerCase().replace(' ', '-')}">${statusIcon} ${app.status}</span></td>
                        <td><span class="status-badge ${app.payment_status.toLowerCase()}">${app.payment_status === 'Received' ? '💰' : '⏱️'} ${app.payment_status}</span></td>
                        <td style="color: ${app.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">${profitIcon} ${formatCurrency(app.profit)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" onclick="editApplication(${app.id})" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon delete" onclick="deleteApplication(${app.id})" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            investorGroupsHTML += `
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h2 style="margin: 0 0 8px 0;">${investor.name}</h2>
                            <div style="display: flex; gap: 16px; font-size: 0.9rem;">
                                <span><i class="fas fa-users"></i> ${investor.family_group || 'N/A'}</span>
                                <span style="color: var(--success-color);"><i class="fas fa-file-alt"></i> ${totalApplications} Applications</span>
                                <span style="color: var(--warning-color);"><i class="fas fa-clock"></i> ${appliedCount} Pending</span>
                                <span style="color: var(--success-color);"><i class="fas fa-trophy"></i> ${allottedCount} Allotted</span>
                                <span style="color: var(--danger-color);"><i class="fas fa-times-circle"></i> ${notAllottedCount} Rejected</span>
                            </div>
                            <div style="display: flex; gap: 16px; font-size: 0.85rem; margin-top: 8px; opacity: 0.8;">
                                <span><i class="fas fa-university"></i> Banks: ${banksUsed.length > 0 ? banksUsed.join(', ') : 'None'}</span>
                                ${investor.upi ? `<span><i class="fas fa-mobile-alt"></i> ${investor.upi}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="text-align: right;">
                                <div style="font-size: 0.85rem; opacity: 0.7;">Total Invested</div>
                                <div style="font-size: 1.3rem; font-weight: 600;">${formatCurrency(totalInvested)}</div>
                                <div style="font-size: 0.85rem; color: ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">Profit: ${formatCurrency(totalProfit)}</div>
                                ${amountBlocked > 0 ? `<div style="font-size: 0.85rem; color: var(--warning-color); font-weight: 600; margin-top: 4px;">Blocked: ${formatCurrency(amountBlocked)}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>IPO Name</th>
                                    <th>Amount</th>
                                    <th>Bank</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Profit</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Investor-wise Analysis</h1>
            </div>
            ${investorGroupsHTML || '<div class="card"><p style="text-align: center; padding: 40px; opacity: 0.7;">No applications found.</p></div>'}
        `;

        addApplicationModal();
    } catch (error) {
        console.error('Error loading investor-wise view:', error);
        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Investor-wise Analysis</h1>
            </div>
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger-color); opacity: 0.5; margin-bottom: 16px;"></i>
                <h2 style="color: var(--danger-color); margin-bottom: 8px;">Error Loading Data</h2>
                <p style="color: var(--text-color); opacity: 0.8;">Unable to load investor data. Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadInvestorWiseView()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Bank-wise View
async function loadBankWiseView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const [appRes, bankStatsRes] = await Promise.all([
            fetch(`${API_BASE}/applications`),
            fetch(`${API_BASE}/reports/bank-stats`)
        ]);

        applications = await appRes.json();
        const bankStats = await bankStatsRes.json();

        // Group applications by bank
        const bankGroups = {};
        applications.forEach(app => {
            const bank = app.bank_name || 'Unknown Bank';
            if (!bankGroups[bank]) {
                bankGroups[bank] = [];
            }
            bankGroups[bank].push(app);
        });

        let bankCardsHTML = '';

        // Create cards for each bank
        Object.keys(bankGroups).sort().forEach(bankName => {
            const apps = bankGroups[bankName];
            const stats = bankStats.find(s => s.bank_name === bankName) || {
                blocked_amount: 0,
                invested_amount: 0,
                blocked_count: 0,
                invested_count: 0
            };

            const totalApplications = apps.length;
            const appliedCount = apps.filter(app => app.status === 'Applied').length;
            const allottedCount = apps.filter(app => app.status === 'Allotted').length;
            const notAllottedCount = apps.filter(app => app.status === 'Not Allotted').length;
            const totalAmount = apps.reduce((sum, app) => sum + (app.application_amount || 0), 0);
            const totalProfit = apps
                .filter(app => app.status === 'Allotted')
                .reduce((sum, app) => sum + (app.profit || 0), 0);

            bankCardsHTML += `
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <h2 style="margin: 0 0 12px 0;"><i class="fas fa-university"></i> ${bankName}</h2>
                            <div style="display: flex; gap: 16px; font-size: 0.9rem;">
                                <span><i class="fas fa-file-alt"></i> ${totalApplications} Applications</span>
                                <span style="color: var(--warning-color);"><i class="fas fa-clock"></i> ${appliedCount} Pending</span>
                                <span style="color: var(--success-color);"><i class="fas fa-check-circle"></i> ${allottedCount} Allotted</span>
                                <span style="color: var(--danger-color);"><i class="fas fa-times-circle"></i> ${notAllottedCount} Rejected</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid var(--warning-color);">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">💰 Amount Blocked</div>
                            <div style="font-size: 1.4rem; font-weight: 600; color: var(--warning-color);">${formatCurrency(stats.blocked_amount)}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">${stats.blocked_count} applications pending</div>
                        </div>
                        
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid var(--success-color);">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">💵 Amount Invested</div>
                            <div style="font-size: 1.4rem; font-weight: 600; color: var(--success-color);">${formatCurrency(stats.invested_amount)}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">${stats.invested_count} allotted applications</div>
                        </div>
                        
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid var(--primary-color);">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">📊 Total Amount</div>
                            <div style="font-size: 1.4rem; font-weight: 600;">${formatCurrency(totalAmount)}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">All applications combined</div>
                        </div>
                        
                        <div style="padding: 16px; background: var(--bg-color); border-radius: 8px; border-left: 4px solid ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 4px;">📈 Total Profit</div>
                            <div style="font-size: 1.4rem; font-weight: 600; color: ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${formatCurrency(totalProfit)}</div>
                            <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 4px;">From allotted IPOs</div>
                        </div>
                    </div>
                </div>
            `;
        });

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Bank-wise Analysis</h1>
            </div>
            
            <div class="card" style="margin-bottom: 24px;">
                <h2 style="margin-bottom: 16px;">💡 Quick Summary</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                    <div style="padding: 20px; background: linear-gradient(135deg, var(--warning-color) 0%, rgba(255, 193, 7, 0.7) 100%); border-radius: 8px; color: white;">
                        <div style="font-size: 0.9rem; margin-bottom: 8px;">🔒 Total Blocked Across All Banks</div>
                        <div style="font-size: 1.8rem; font-weight: 700;">${formatCurrency(bankStats.reduce((sum, s) => sum + s.blocked_amount, 0))}</div>
                    </div>
                    
                    <div style="padding: 20px; background: linear-gradient(135deg, var(--success-color) 0%, rgba(76, 175, 80, 0.7) 100%); border-radius: 8px; color: white;">
                        <div style="font-size: 0.9rem; margin-bottom: 8px;">✅ Total Invested Across All Banks</div>
                        <div style="font-size: 1.8rem; font-weight: 700;">${formatCurrency(bankStats.reduce((sum, s) => sum + s.invested_amount, 0))}</div>
                    </div>
                    
                    <div style="padding: 20px; background: linear-gradient(135deg, var(--primary-color) 0%, rgba(33, 150, 243, 0.7) 100%); border-radius: 8px; color: white;">
                        <div style="font-size: 0.9rem; margin-bottom: 8px;">🏦 Total Banks Used</div>
                        <div style="font-size: 1.8rem; font-weight: 700;">${Object.keys(bankGroups).length}</div>
                    </div>
                </div>
            </div>
            
            ${bankCardsHTML}
        `;
    } catch (error) {
        console.error('Error loading bank-wise view:', error);
        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Bank-wise Analysis</h1>
            </div>
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger-color); opacity: 0.5; margin-bottom: 16px;"></i>
                <h2 style="color: var(--danger-color); margin-bottom: 8px;">Error Loading Data</h2>
                <p style="color: var(--text-color); opacity: 0.8;">Unable to load bank data. Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadBankWiseView()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Money Transfers View
async function loadMoneyTransfersView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const response = await fetch(`${API_BASE}/money-transfers`);
        const transfers = await response.json();

        const pendingTransfers = transfers.filter(t => t.repayment_status === 'Pending');
        const completedTransfers = transfers.filter(t => t.repayment_status === 'Completed');
        const totalPending = pendingTransfers.reduce((sum, t) => sum + t.amount, 0);
        const totalCompleted = completedTransfers.reduce((sum, t) => sum + t.amount, 0);

        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Money Transfers</h1>
                <button class="btn btn-primary" onclick="openMoneyTransferModal()">
                    <i class="fas fa-plus"></i> Record Transfer
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value" style="color: var(--warning-color);">${formatCurrency(totalPending)}</div>
                    <div class="stat-label">Pending Repayment</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-value" style="color: var(--success-color);">${formatCurrency(totalCompleted)}</div>
                    <div class="stat-label">Completed</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                    <div class="stat-value">${transfers.length}</div>
                    <div class="stat-label">Total Transfers</div>
                </div>
            </div>
            
            <div class="card">
                <h2 style="margin-bottom: 20px;">Transfer History</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Amount</th>
                                <th>Purpose</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transfers.map(transfer => {
            const statusColor = transfer.repayment_status === 'Completed' ? 'var(--success-color)' : 'var(--warning-color)';
            const statusIcon = transfer.repayment_status === 'Completed' ? '✅' : '⏳';

            return `
                                    <tr style="border-left: 3px solid ${statusColor};">
                                        <td>${formatDate(transfer.transfer_date)}</td>
                                        <td><strong>${transfer.from_person}</strong></td>
                                        <td><strong>${transfer.to_person}</strong></td>
                                        <td style="font-weight: 600;">${formatCurrency(transfer.amount)}</td>
                                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${transfer.purpose || '-'}</td>
                                        <td>
                                            <span class="status-badge ${transfer.repayment_status.toLowerCase()}">
                                                ${statusIcon} ${transfer.repayment_status}
                                            </span>
                                            ${transfer.repayment_date ? `<br><small style="opacity: 0.7;">Repaid: ${formatDate(transfer.repayment_date)}</small>` : ''}
                                        </td>
                                        <td>
                                            <div class="action-buttons">
                                                <button class="btn-icon" onclick="editMoneyTransfer(${transfer.id})" title="Edit">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                ${transfer.repayment_status === 'Pending' ? `
                                                    <button class="btn-icon" onclick="markAsRepaid(${transfer.id})" title="Mark as Repaid" style="color: var(--success-color);">
                                                        <i class="fas fa-check"></i>
                                                    </button>
                                                ` : ''}
                                                <button class="btn-icon delete" onclick="deleteMoneyTransfer(${transfer.id})" title="Delete">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        addMoneyTransferModal();
    } catch (error) {
        console.error('Error loading money transfers:', error);
        contentArea.innerHTML = `
            <div class="header-actions">
                <h1>Money Transfers</h1>
            </div>
            <div class="card" style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger-color); opacity: 0.5; margin-bottom: 16px;"></i>
                <h2 style="color: var(--danger-color); margin-bottom: 8px;">Error Loading Transfers</h2>
                <p style="color: var(--text-color); opacity: 0.8;">Unable to load transfer data. Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadMoneyTransfersView()" style="margin-top: 20px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Reports View
async function loadReportsView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<h1>Loading...</h1>';

    try {
        const [bankStatsRes, ipoProfitRes] = await Promise.all([
            fetch(`${API_BASE}/reports/bank-stats`),
            fetch(`${API_BASE}/reports/ipo-profit`)
        ]);

        const bankStats = await bankStatsRes.json();
        const ipoProfit = await ipoProfitRes.json();

        contentArea.innerHTML = `
        <div class="header-actions">
        <h1>Reports & Analytics</h1>
            </div>
            
            <div class="card">
                <h2 style="margin-bottom: 20px;">Bank-wise Statistics</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Bank Name</th>
                                <th>Blocked Amount</th>
                                <th>Invested Amount</th>
                                <th>Blocked Count</th>
                                <th>Invested Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bankStats.map(stat => `
                                <tr>
                                    <td><strong>${stat.bank_name}</strong></td>
                                    <td>${formatCurrency(stat.blocked_amount)}</td>
                                    <td>${formatCurrency(stat.invested_amount)}</td>
                                    <td>${stat.blocked_count}</td>
                                    <td>${stat.invested_count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-top: 24px;">
                <h2 style="margin-bottom: 20px;">IPO Profit Summary</h2>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>IPO Name</th>
                                <th>Allotted Count</th>
                                <th>Total Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ipoProfit.map(ipo => `
                                <tr>
                                    <td><strong>${ipo.ipo_name}</strong></td>
                                    <td>${ipo.allotted_count}</td>
                                    <td style="color: ${ipo.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">
                                        ${formatCurrency(ipo.profit)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading reports:', error);
        contentArea.innerHTML = '<h1>Error loading reports</h1>';
    }
}

// Settings View
function loadSettingsView() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
            <div class="header-actions">
            <h1>Settings</h1>
        </div>

            <div class="card">
                <h2>Application Settings</h2>
                <p style="color: var(--text-color); margin-top: 16px;">Settings and configuration options coming soon...</p>
            </div>
    `;
}


// Toast Notification Function
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' : 'info-circle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Helper Functions
function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(value || 0);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
}

// Quick Apply Function
async function quickApply(investorId, ipoId, amount, upiId) {
    // Removed confirm dialog for faster interaction
    try {
        const response = await fetch(`${API_BASE}/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                investor_id: investorId,
                ipo_id: ipoId,
                application_amount: amount,
                status: 'Applied',
                payment_status: 'Pending',
                bank_name: '' // Allow empty bank initially for quick apply
            })
        });

        if (response.ok) {
            showToast('Application added successfully', 'success');
            // Optimistic UI update or silent reload could be better, 
            // but for now, reload the view to show updated state
            loadApplicationsView();
        } else {
            showToast('Failed to apply. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error applying:', error);
        showToast('Error occurred while applying.', 'error');
    }
}

// Modal Functions
function addInvestorModal() {
    if (document.getElementById('investor-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'investor-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
            <div class="modal-content">
            <div class="modal-header">
                <h2>Add/Edit Investor</h2>
                <button class="close" onclick="closeModal('investor-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="investor-form">
                <input type="hidden" id="investor-id">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="investor-name" required>
                </div>
                <div class="form-group">
                    <label>UPI ID</label>
                    <input type="text" id="investor-upi">
                </div>
                <div class="form-group">
                    <label>Family Group</label>
                    <select id="investor-group">
                        <option>Family</option>
                        <option>Friends</option>
                        <option>Relatives</option>
                        <option>Self</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Banks (comma-separated)</label>
                    <input type="text" id="investor-banks" placeholder="e.g. HDFC Bank, ICICI Bank, SBI">
                </div>
                <button type="submit" class="btn btn-primary">Save Investor</button>
            </form>
        </div>
            `;
    document.body.appendChild(modal);

    document.getElementById('investor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('investor-id').value;
        const data = {
            name: document.getElementById('investor-name').value,
            upi: document.getElementById('investor-upi').value,
            family_group: document.getElementById('investor-group').value,
            banks: document.getElementById('investor-banks').value
        };

        const url = id ? `${API_BASE}/investors/${id}` : `${API_BASE}/investors`;
        const method = id ? 'PUT' : 'POST';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        closeModal('investor-modal');
        loadInvestorsView();
    });
}

function addIPOModal() {
    if (document.getElementById('ipo-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ipo-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add/Edit IPO</h2>
                <button class="close" onclick="closeModal('ipo-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="ipo-form">
                <input type="hidden" id="ipo-id">
                <div class="form-group">
                    <label>IPO Name *</label>
                    <input type="text" id="ipo-name" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select id="ipo-type">
                            <option>Mainboard</option>
                            <option>SME</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="ipo-status">
                            <option>Open</option>
                            <option>Closed</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>IPO Date</label>
                        <input type="date" id="ipo-date">
                    </div>
                    <div class="form-group">
                        <label>Listing Date</label>
                        <input type="date" id="ipo-listing-date">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Number of Shares *</label>
                        <input type="number" id="ipo-shares" required>
                    </div>
                    <div class="form-group">
                        <label>Purchase Price *</label>
                        <input type="number" step="0.01" id="ipo-buy-price" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Sale Price (optional)</label>
                    <input type="number" step="0.01" id="ipo-sell-price">
                </div>
                <button type="submit" class="btn btn-primary">Save IPO</button>
            </form>
        </div>
            `;
    document.body.appendChild(modal);

    document.getElementById('ipo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('ipo-id').value;
        const data = {
            ipo_name: document.getElementById('ipo-name').value,
            ipo_type: document.getElementById('ipo-type').value,
            status: document.getElementById('ipo-status').value,
            ipo_date: document.getElementById('ipo-date').value,
            listing_date: document.getElementById('ipo-listing-date').value,
            num_shares: parseInt(document.getElementById('ipo-shares').value),
            purchase_price_per_share: parseFloat(document.getElementById('ipo-buy-price').value),
            sale_price_per_share: document.getElementById('ipo-sell-price').value ? parseFloat(document.getElementById('ipo-sell-price').value) : null
        };

        const url = id ? `${API_BASE}/ipos/${id}` : `${API_BASE}/ipos`;
        const method = id ? 'PUT' : 'POST';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        closeModal('ipo-modal');
        loadIPOsView();
    });
}

function addApplicationModal() {
    if (document.getElementById('application-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'application-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add/Edit Application</h2>
                <button class="close" onclick="closeModal('application-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="application-form">
                <input type="hidden" id="application-id">
                <div class="form-group">
                    <label>Investor *</label>
                    <select id="app-investor" required>
                        ${investors.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>IPO *</label>
                    <select id="app-ipo" required>
                        ${ipos.map(i => `<option value="${i.id}">${i.ipo_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Application Amount *</label>
                    <input type="number" step="0.01" id="app-amount" required>
                </div>
                <div class="form-group">
                    <label>Bank Name *</label>
                    <select id="app-bank" required>
                        <option value="">Select a bank</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Status</label>
                        <select id="app-status">
                            <option>Applied</option>
                            <option>Allotted</option>
                            <option>Not Allotted</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Payment Status</label>
                        <select id="app-payment">
                            <option>Pending</option>
                            <option>Received</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Funding Source</label>
                        <select id="app-funding-source">
                            <option value="Own">Own Money</option>
                            <option value="Borrowed">Borrowed</option>
                            <option value="UPI">UPI Transfer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Lender Name (if borrowed)</label>
                        <input type="text" id="app-lender-name" placeholder="Name of person who lent money">
                    </div>
                </div>
                
                <div class="form-group" id="repayment-status-group" style="display: none;">
                    <label>Repayment Status</label>
                    <select id="app-repayment-status">
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="N/A">N/A</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Save Application</button>
            </form>
        </div>
            `;
    document.body.appendChild(modal);

    // Add event listener for investor dropdown to populate banks
    document.getElementById('app-investor').addEventListener('change', function () {
        const investorId = parseInt(this.value);
        const investor = investors.find(inv => inv.id === investorId);
        const bankSelect = document.getElementById('app-bank');

        // Clear existing options
        bankSelect.innerHTML = '<option value="">Select a bank</option>';

        if (investor && investor.banks) {
            // Parse comma-separated banks and create options
            const banks = investor.banks.split(',').map(b => b.trim()).filter(b => b);
            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank;
                option.textContent = bank;
                bankSelect.appendChild(option);
            });
        }
    });

    // Add event listener for IPO dropdown to auto-calculate amount
    document.getElementById('app-ipo').addEventListener('change', function () {
        const ipoId = parseInt(this.value);
        const ipo = ipos.find(i => i.id === ipoId);
        const amountInput = document.getElementById('app-amount');

        if (ipo && ipo.num_shares && ipo.purchase_price_per_share) {
            const calculatedAmount = ipo.num_shares * ipo.purchase_price_per_share;
            amountInput.value = calculatedAmount.toFixed(2);
        }
    });

    // Add event listener for funding source dropdown
    document.getElementById('app-funding-source').addEventListener('change', function () {
        const fundingSource = this.value;
        const lenderNameField = document.getElementById('app-lender-name');
        const repaymentStatusGroup = document.getElementById('repayment-status-group');

        if (fundingSource === 'Borrowed') {
            lenderNameField.required = true;
            lenderNameField.style.display = 'block';
            repaymentStatusGroup.style.display = 'block';
        } else {
            lenderNameField.required = false;
            lenderNameField.value = '';
            repaymentStatusGroup.style.display = 'none';
            document.getElementById('app-repayment-status').value = 'N/A';
        }
    });

    document.getElementById('application-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate required fields
        const investorId = document.getElementById('app-investor').value;
        const ipoId = document.getElementById('app-ipo').value;
        const amount = document.getElementById('app-amount').value;
        const bankName = document.getElementById('app-bank').value;

        const errors = [];
        if (!investorId) errors.push('Investor is required');
        if (!ipoId) errors.push('IPO is required');
        if (!amount || parseFloat(amount) <= 0) errors.push('Valid application amount is required');
        if (!bankName) errors.push('Bank name is required');

        if (errors.length > 0) {
            alert('Please fix the following errors:\n\n' + errors.join('\n'));
            return;
        }

        const id = document.getElementById('application-id').value;
        const data = {
            investor_id: parseInt(investorId),
            ipo_id: parseInt(ipoId),
            application_amount: parseFloat(amount),
            status: document.getElementById('app-status').value,
            payment_status: document.getElementById('app-payment').value,
            bank_name: bankName,
            sell_price: document.getElementById('app-sell-price') ? parseFloat(document.getElementById('app-sell-price').value) : null,
            funding_source: document.getElementById('app-funding-source').value,
            lender_name: document.getElementById('app-lender-name').value,
            repayment_status: document.getElementById('app-repayment-status').value
        };

        try {
            if (id) {
                await fetch(`${API_BASE}/applications/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                await fetch(`${API_BASE}/applications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            closeModal('application-modal');
            loadApplicationsView();
        } catch (error) {
            console.error('Error saving application:', error);
            alert('Failed to save application');
        }
    });
}

function addImportModal() {
    if (document.getElementById('import-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
            <div class="modal-content">
            <div class="modal-header">
                <h2>Import Investors</h2>
                <button class="close" onclick="closeModal('import-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="import-form">
                <div class="form-group">
                    <label>Excel File</label>
                    <input type="file" id="import-file" accept=".xlsx,.xls" required>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-color); margin-bottom: 20px;">
                    <a href="#" onclick="downloadTemplate(event)" style="color: var(--secondary-color);">Download Template</a>
                </p>
                <button type="submit" class="btn btn-primary">Import</button>
            </form>
        </div>
            `;
    document.body.appendChild(modal);

    document.getElementById('import-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('import-file');
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await fetch(`${API_BASE}/investors/import`, {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            alert(result.message || 'Import successful');
            closeModal('import-modal');
            loadInvestorsView();
        } catch (error) {
            alert('Import failed');
        }
    });
}

function openInvestorModal() {
    document.getElementById('investor-id').value = '';
    document.getElementById('investor-form').reset();
    document.getElementById('investor-modal').classList.remove('hidden');
}

function openIPOModal() {
    document.getElementById('ipo-id').value = '';
    document.getElementById('ipo-form').reset();
    document.getElementById('ipo-modal').classList.remove('hidden');
}

function openApplicationModal(prefilledIPOId = null) {
    // Reset form
    document.getElementById('application-id').value = '';
    document.getElementById('application-form').reset();

    // Prefill IPO if provided
    if (prefilledIPOId) {
        const ipoSelect = document.getElementById('app-ipo');
        if (ipoSelect) {
            ipoSelect.value = prefilledIPOId;
            // Trigger change event to auto-calculate amount
            ipoSelect.dispatchEvent(new Event('change'));
        }
    }

    // Prefill investor with first available investor
    if (investors.length > 0) {
        const investorSelect = document.getElementById('app-investor');
        if (investorSelect) {
            investorSelect.value = investors[0].id;
            // Trigger change event to populate banks
            investorSelect.dispatchEvent(new Event('change'));
        }
    }

    document.getElementById('application-modal').classList.remove('hidden');
}

function openImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Helper to update field inline
async function updateApplicationField(id, field, value) {
    try {
        const body = {};
        body[field] = value;
        // Special case for Bank Name: also needs to be saved but no special logic needed as API handles partial updates

        await fetch(`${API_BASE}/applications/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        showToast('Updated successfully', 'success');

        // Reload view to update stats (can be optimized to not reload full view)
        // loadApplicationsView(); 
        // For smoother UX, maybe don't reload immediately, but the stats won't update.
        // Let's reload for now to ensure consistency.
        loadApplicationsView();

    } catch (error) {
        console.error('Error updating application:', error);
        showToast('Failed to update', 'error');
    }
}

// Edit Functions
function editInvestor(id) {
    const inv = investors.find(i => i.id === id);
    if (!inv) return;
    document.getElementById('investor-id').value = inv.id;
    document.getElementById('investor-name').value = inv.name;
    document.getElementById('investor-upi').value = inv.upi || '';
    document.getElementById('investor-group').value = inv.family_group;
    document.getElementById('investor-banks').value = inv.banks || '';
    document.getElementById('investor-modal').classList.remove('hidden');
}

function editIPO(id) {
    const ipo = ipos.find(i => i.id === id);
    if (!ipo) return;
    document.getElementById('ipo-id').value = ipo.id;
    document.getElementById('ipo-name').value = ipo.ipo_name;
    document.getElementById('ipo-type').value = ipo.ipo_type || 'Mainboard';
    document.getElementById('ipo-status').value = ipo.status || 'Open';
    document.getElementById('ipo-date').value = ipo.ipo_date || '';
    document.getElementById('ipo-listing-date').value = ipo.listing_date || '';
    document.getElementById('ipo-shares').value = ipo.num_shares;
    document.getElementById('ipo-buy-price').value = ipo.purchase_price_per_share;
    document.getElementById('ipo-sell-price').value = ipo.sale_price_per_share || '';
    document.getElementById('ipo-modal').classList.remove('hidden');
}

function editApplication(id) {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    document.getElementById('application-id').value = app.id;
    document.getElementById('app-investor').value = app.investor_id;
    document.getElementById('app-ipo').value = app.ipo_id;
    document.getElementById('app-amount').value = app.application_amount;
    document.getElementById('app-status').value = app.status;
    document.getElementById('app-payment').value = app.payment_status;

    // Fix: Explicitly populate banks for the selected investor
    const investor = investors.find(i => i.id === app.investor_id);
    const bankSelect = document.getElementById('app-bank');
    bankSelect.innerHTML = '<option value="">Select a bank</option>'; // Clear first

    if (investor && investor.banks) {
        const banks = investor.banks.split(',').map(b => b.trim()).filter(b => b);
        banks.forEach(bank => {
            const option = document.createElement('option');
            option.value = bank;
            option.textContent = bank;
            bankSelect.appendChild(option);
        });
    }

    // Now set the value
    document.getElementById('app-bank').value = app.bank_name || '';

    document.getElementById('application-modal').classList.remove('hidden');
}

// Delete Functions
async function deleteInvestor(id) {
    if (confirm('Are you sure you want to delete this investor?')) {
        await fetch(`${API_BASE}/investors/${id}`, { method: 'DELETE' });
        loadInvestorsView();
    }
}

async function deleteIPO(id) {
    if (confirm('Are you sure you want to delete this IPO?')) {
        await fetch(`${API_BASE}/ipos/${id}`, { method: 'DELETE' });
        loadIPOsView();
    }
}

async function deleteApplication(id) {
    if (confirm('Are you sure you want to delete this application?')) {
        await fetch(`${API_BASE}/applications/${id}`, { method: 'DELETE' });
        loadApplicationsView();
    }
}

function downloadTemplate(e) {
    e.preventDefault();
    window.location.href = `${API_BASE}/investors/template`;
}
//
// Money Transfer Modal and Functions
function addMoneyTransferModal() {
    if (document.getElementById('money-transfer-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'money-transfer-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Record Money Transfer</h2>
                <button class="close" onclick="closeModal('money-transfer-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="money-transfer-form">
                <input type="hidden" id="transfer-id">
                <div class="form-row">
                    <div class="form-group">
                        <label>From Person *</label>
                        <input type="text" id="transfer-from" required placeholder="Who sent the money">
                    </div>
                    <div class="form-group">
                        <label>To Person *</label>
                        <input type="text" id="transfer-to" required placeholder="Who received the money">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Amount *</label>
                        <input type="number" step="0.01" id="transfer-amount" required>
                    </div>
                    <div class="form-group">
                        <label>Transfer Date</label>
                        <input type="date" id="transfer-date">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Purpose</label>
                    <input type="text" id="transfer-purpose" placeholder="e.g., IPO Application - Company XYZ">
                </div>
                
                <div class="form-group">
                    <label>Repayment Status</label>
                    <select id="transfer-repayment-status">
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="transfer-notes" rows="3" placeholder="Additional notes..."></textarea>
                </div>
                
                <button type="submit" class="btn btn-primary">Save Transfer</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('money-transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('transfer-id').value;
        const data = {
            from_person: document.getElementById('transfer-from').value,
            to_person: document.getElementById('transfer-to').value,
            amount: parseFloat(document.getElementById('transfer-amount').value),
            transfer_date: document.getElementById('transfer-date').value,
            purpose: document.getElementById('transfer-purpose').value,
            repayment_status: document.getElementById('transfer-repayment-status').value,
            notes: document.getElementById('transfer-notes').value
        };

        try {
            const url = id ? `${API_BASE}/money-transfers/${id}` : `${API_BASE}/money-transfers`;
            const method = id ? 'PUT' : 'POST';

            await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            closeModal('money-transfer-modal');
            loadMoneyTransfersView();
        } catch (error) {
            console.error('Error saving money transfer:', error);
            alert('Failed to save money transfer');
        }
    });
}

function openMoneyTransferModal() {
    document.getElementById('transfer-id').value = '';
    document.getElementById('money-transfer-form').reset();
    document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('money-transfer-modal').classList.remove('hidden');
}

function editMoneyTransfer(id) {
    // This would need to fetch the transfer data and populate the form
    // For now, just open the modal
    openMoneyTransferModal();
}

async function markAsRepaid(id) {
    if (confirm('Mark this transfer as repaid?')) {
        try {
            await fetch(`${API_BASE}/money-transfers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repayment_status: 'Completed',
                    repayment_date: new Date().toISOString().split('T')[0]
                })
            });
            loadMoneyTransfersView();
        } catch (error) {
            console.error('Error updating transfer:', error);
            alert('Failed to update transfer');
        }
    }
}

async function deleteMoneyTransfer(id) {
    if (confirm('Are you sure you want to delete this money transfer?')) {
        try {
            await fetch(`${API_BASE}/money-transfers/${id}`, { method: 'DELETE' });
            loadMoneyTransfersView();
        } catch (error) {
            console.error('Error deleting transfer:', error);
            showToast('Failed to delete transfer', 'error');
        }
    }
}

// Bulk Action Helpers
function toggleAll(source, className) {
    const checkboxes = document.querySelectorAll('.' + className);
    checkboxes.forEach(cb => {
        cb.checked = source.checked;
        toggleRowSelection(cb); // Update individual row if needed, but bulk update is faster
    });
    updateBulkActionVisibility(className);
}

function toggleRowSelection(checkbox) {
    // Find the group class name from the checkbox class list
    const className = Array.from(checkbox.classList).find(c => c.startsWith('app-checkbox-'));
    if (className) {
        updateBulkActionVisibility(className);
    }
}

function updateBulkActionVisibility(className) {
    // Extract IPO ID from class name 'app-checkbox-{id}'
    const ipoId = className.split('-')[2];
    const checkboxes = document.querySelectorAll('.' + className);
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const bulkActions = document.getElementById(`bulk-actions-${ipoId}`);

    // Also toggle checkbox header state if needed, but standard behavior is fine

    if (bulkActions) {
        bulkActions.style.display = checkedCount > 0 ? 'flex' : 'none';
        // Add animation or transition if desired
    }
}

async function bulkDelete(className) {
    const checkboxes = document.querySelectorAll(`.${className}:checked`);
    if (checkboxes.length === 0) return;

    if (!confirm(`Delete ${checkboxes.length} applications?`)) return;

    let successCount = 0;
    // Show loading state?

    for (const cb of checkboxes) {
        try {
            const id = cb.getAttribute('data-id');
            await fetch(`${API_BASE}/applications/${id}`, { method: 'DELETE' });
            successCount++;
        } catch (e) {
            console.error(e);
        }
    }

    showToast(`Deleted ${successCount} applications`, 'success');
    loadApplicationsView();
}

async function bulkUpdateStatus(className, status) {
    const checkboxes = document.querySelectorAll(`.${className}:checked`);
    if (checkboxes.length === 0) return;

    let successCount = 0;
    for (const cb of checkboxes) {
        try {
            const id = cb.getAttribute('data-id');
            await fetch(`${API_BASE}/applications/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status })
            });
            successCount++;
        } catch (e) {
            console.error(e);
        }
    }
    showToast(`Updated ${successCount} applications to ${status}`, 'success');
    loadApplicationsView();
}