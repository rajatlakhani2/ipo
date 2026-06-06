// This file contains the updated loadApplicationsView section
// Copy this into script.js starting at line 691

// Create IPO groups with ALL investors
let ipoGroupsHTML = '';

ipos.forEach(ipo => {
    // Smart Filtering: If IPO is Closed, only show Allotted applications
    const isClosed = ipo.status === 'Closed';

    // Get existing applications for this IPO
    const existingApps = applications.filter(app => app.ipo_id === ipo.id);
    const existingAppMap = new Map(existingApps.map(app => [app.investor_id, app]));

    // Create rows
    let rows = '';

    if (isClosed) {
        // For Closed IPOs: Only show Allotted applications
        const allottedApps = existingApps.filter(app => app.status === 'Allotted');

        if (allottedApps.length === 0) {
            rows = '<tr><td colspan="9" style="text-align: center; color: var(--text-color); opacity: 0.6; padding: 20px;">No allotted applications for this closed IPO.</td></tr>';
        } else {
            rows = allottedApps.map(app => {
                const investor = investors.find(inv => inv.id === app.investor_id);
                if (!investor) return '';

                const profitIcon = app.profit > 0 ? '📈' : app.profit < 0 ? '📉' : '➖';
                const borderColor = 'var(--success-color)';

                const investorBanks = investor.banks ? investor.banks.split(',').map(b => b.trim()) : [];
                let bankOptions = investorBanks.map(bank =>
                    `<option value="${bank}" ${bank === app.bank_name ? 'selected' : ''}>${bank}</option>`
                ).join('');
                if (app.bank_name && !investorBanks.includes(app.bank_name)) {
                    bankOptions += `<option value="${app.bank_name}" selected>${app.bank_name}</option>`;
                }

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
                                <td style="width: 180px;">${bankSelect}</td>
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
        // For Open/Upcoming IPOs
        rows = investors.map(investor => {
            const existingApp = existingAppMap.get(investor.id);

            if (existingApp) {
                const profitIcon = existingApp.profit > 0 ? '📈' : existingApp.profit < 0 ? '📉' : '➖';
                const statusClass = existingApp.status === 'Allotted' ? 'status-allotted' : existingApp.status === 'Not Allotted' ? 'status-not-allotted' : 'status-applied';
                const borderColor = existingApp.status === 'Allotted' ? 'var(--success-color)' : existingApp.status === 'Not Allotted' ? 'var(--danger-color)' : 'var(--warning-color)';

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

                const statusSelect = `
                            <select class="inline-select ${statusClass}" onchange="updateApplicationField(${existingApp.id}, 'status', this.value)">
                                <option value="Applied" ${existingApp.status === 'Applied' ? 'selected' : ''}>Applied</option>
                                <option value="Allotted" ${existingApp.status === 'Allotted' ? 'selected' : ''}>Allotted</option>
                                <option value="Not Allotted" ${existingApp.status === 'Not Allotted' ? 'selected' : ''}>Not Allotted</option>
                            </select>
                        `;

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

    // Calculate summary for this IPO
    const summary = calculateIPOSummary(existingApps);
    const ipoApps = summary.totalApplications;
    const applied = summary.appliedCount;
    const allotted = summary.allottedCount;
    const totalInvested = summary.totalInvested;
    const totalProfit = summary.totalProfit;

    // Table headers with checkbox
    const tableHeader = isClosed ?
        `<tr>
                    <th style="width: 40px;"><input type="checkbox" onchange="toggleAll(this, 'app-checkbox-${ipo.id}')"></th>
                    <th>Investor</th>
                    <th>Sell Price</th>
                    <th>Amount</th>
                    <th>Bank</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Profit</th>
                    <th>Actions</th>
                </tr>` :
        `<tr>
                    <th style="width: 40px;"><input type="checkbox" onchange="toggleAll(this, 'app-checkbox-${ipo.id}')"></th>
                    <th>Investor</th>
                    <th>Sell Price</th>
                    <th>Amount</th>
                    <th>Bank / UPI</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Profit</th>
                    <th>Actions</th>
                </tr>`;

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
                                ${tableHeader}
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
});
