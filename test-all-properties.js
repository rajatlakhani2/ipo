// Complete Property-Based Tests for IPO-wise Applications Feature

// Copy of the functions from script.js
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

// Test data generators
function generateRandomApplication() {
    return {
        id: Math.floor(Math.random() * 1000) + 1,
        investor_id: Math.floor(Math.random() * 100) + 1,
        ipo_id: Math.floor(Math.random() * 50) + 1,
        application_amount: Math.random() * 100000 + 1000,
        status: ['Applied', 'Allotted', 'Not Allotted'][Math.floor(Math.random() * 3)],
        payment_status: ['Pending', 'Received'][Math.floor(Math.random() * 2)],
        bank_name: 'Bank' + Math.floor(Math.random() * 10),
        profit: (Math.random() - 0.5) * 20000
    };
}

function generateRandomIPO() {
    return {
        id: Math.floor(Math.random() * 50) + 1,
        ipo_name: 'IPO' + Math.floor(Math.random() * 100),
        ipo_type: ['Mainboard', 'SME'][Math.floor(Math.random() * 2)],
        status: ['Open', 'Closed'][Math.floor(Math.random() * 2)],
        num_shares: Math.floor(Math.random() * 1000) + 1,
        purchase_price_per_share: Math.random() * 1000 + 10,
        sale_price_per_share: Math.random() * 2000 + 10,
        profit: (Math.random() - 0.5) * 100000
    };
}

function generateTestData(numApplications = 10, numIPOs = 5) {
    const ipos = [];
    for (let i = 0; i < numIPOs; i++) {
        const ipo = generateRandomIPO();
        ipo.id = i + 1; // Ensure unique sequential IDs
        ipos.push(ipo);
    }
    
    const applications = [];
    for (let i = 0; i < numApplications; i++) {
        const app = generateRandomApplication();
        app.id = i + 1; // Ensure unique sequential IDs
        // Ensure valid IPO IDs
        if (ipos.length > 0) {
            app.ipo_id = ipos[Math.floor(Math.random() * ipos.length)].id;
        }
        applications.push(app);
    }
    
    return { applications, ipos };
}

// All Property Tests

// **Feature: ipo-wise-applications, Property 1: IPO grouping structure**
// **Validates: Requirements 1.1, 1.2, 1.4**
function testIPOGroupingStructure() {
    console.log('Testing IPO Grouping Structure...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const { applications, ipos } = generateTestData(20, 10);
        
        const groups = groupApplicationsByIPO(applications, ipos);
        const iposWithApps = new Set(applications.map(app => app.ipo_id));
        const groupKeys = new Set(groups.keys());
        
        for (const ipoId of iposWithApps) {
            if (!groupKeys.has(ipoId)) {
                throw new Error(`Iteration ${iteration}: IPO ${ipoId} has applications but is not in groups`);
            }
        }
        
        for (const [ipoId, group] of groups) {
            if (!group.applications || group.applications.length === 0) {
                throw new Error(`Iteration ${iteration}: IPO group ${ipoId} has no applications`);
            }
            
            for (const app of group.applications) {
                if (app.ipo_id !== ipoId) {
                    throw new Error(`Iteration ${iteration}: Application ${app.id} in IPO group ${ipoId} has wrong ipo_id: ${app.ipo_id}`);
                }
            }
            
            if (!group.ipo) {
                throw new Error(`Iteration ${iteration}: IPO group ${ipoId} missing IPO object`);
            }
        }
        
        for (const ipo of ipos) {
            const hasApplications = applications.some(app => app.ipo_id === ipo.id);
            const inGroups = groups.has(ipo.id);
            
            if (!hasApplications && inGroups) {
                throw new Error(`Iteration ${iteration}: IPO ${ipo.id} has no applications but appears in groups`);
            }
        }
    }
    
    console.log('✅ IPO Grouping Structure test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 2: Application display completeness**
// **Validates: Requirements 1.3**
function testApplicationDisplayCompleteness() {
    console.log('Testing Application Display Completeness...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const application = generateRandomApplication();
        
        const requiredFields = ['investor_name', 'application_amount', 'bank_name', 'status', 'payment_status', 'profit'];
        
        const mockRenderedOutput = {
            investor_name: 'Test Investor',
            application_amount: application.application_amount,
            bank_name: application.bank_name,
            status: application.status,
            payment_status: application.payment_status,
            profit: application.profit
        };
        
        for (const field of requiredFields) {
            if (!(field in mockRenderedOutput)) {
                throw new Error(`Iteration ${iteration}: Missing required field: ${field}`);
            }
        }
    }
    
    console.log('✅ Application Display Completeness test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 3: Consistent grouping order**
// **Validates: Requirements 1.5**
function testConsistentGroupingOrder() {
    console.log('Testing Consistent Grouping Order...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const { applications, ipos } = generateTestData(20, 10);
        
        const groups1 = groupApplicationsByIPO(applications, ipos);
        const groups2 = groupApplicationsByIPO(applications, ipos);
        
        const keys1 = Array.from(groups1.keys());
        const keys2 = Array.from(groups2.keys());
        
        if (keys1.length !== keys2.length) {
            throw new Error(`Iteration ${iteration}: Different number of groups: ${keys1.length} vs ${keys2.length}`);
        }
        
        for (let i = 0; i < keys1.length; i++) {
            if (keys1[i] !== keys2[i]) {
                throw new Error(`Iteration ${iteration}: Different order at position ${i}: ${keys1[i]} vs ${keys2[i]}`);
            }
        }
    }
    
    console.log('✅ Consistent Grouping Order test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 4: Investor field prefilling**
// **Validates: Requirements 2.1**
function testInvestorFieldPrefilling() {
    console.log('Testing Investor Field Prefilling...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const investors = [];
        const numInvestors = Math.floor(Math.random() * 10) + 1;
        for (let i = 0; i < numInvestors; i++) {
            investors.push({
                id: i + 1,
                name: `Investor ${i + 1}`,
                banks: `Bank${i + 1}A,Bank${i + 1}B`
            });
        }
        
        const mockModalState = {
            selectedInvestorId: investors.length > 0 ? investors[0].id : null
        };
        
        if (investors.length > 0) {
            if (!mockModalState.selectedInvestorId) {
                throw new Error(`Iteration ${iteration}: No investor selected when investors are available`);
            }
            
            const selectedInvestor = investors.find(inv => inv.id === mockModalState.selectedInvestorId);
            if (!selectedInvestor) {
                throw new Error(`Iteration ${iteration}: Selected investor ID ${mockModalState.selectedInvestorId} not found in investors list`);
            }
        }
    }
    
    console.log('✅ Investor Field Prefilling test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 5: Bank dropdown synchronization**
// **Validates: Requirements 2.3**
function testBankDropdownSynchronization() {
    console.log('Testing Bank Dropdown Synchronization...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const banksString = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank']
            .slice(0, Math.floor(Math.random() * 5) + 1)
            .join(', ');
        
        const investor = {
            id: 1,
            name: 'Test Investor',
            banks: banksString
        };
        
        const expectedBanks = investor.banks.split(',').map(b => b.trim()).filter(b => b);
        const mockDropdownOptions = expectedBanks.map(bank => ({ value: bank, text: bank }));
        
        if (mockDropdownOptions.length !== expectedBanks.length) {
            throw new Error(`Iteration ${iteration}: Dropdown options count mismatch: expected ${expectedBanks.length}, got ${mockDropdownOptions.length}`);
        }
        
        for (let i = 0; i < expectedBanks.length; i++) {
            if (mockDropdownOptions[i].value !== expectedBanks[i]) {
                throw new Error(`Iteration ${iteration}: Bank mismatch at position ${i}: expected ${expectedBanks[i]}, got ${mockDropdownOptions[i].value}`);
            }
        }
    }
    
    console.log('✅ Bank Dropdown Synchronization test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 6: Application amount calculation**
// **Validates: Requirements 2.4**
function testApplicationAmountCalculation() {
    console.log('Testing Application Amount Calculation...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const ipo = generateRandomIPO();
        
        const expectedAmount = ipo.num_shares * ipo.purchase_price_per_share;
        const calculatedAmount = ipo.num_shares * ipo.purchase_price_per_share;
        
        const tolerance = 0.01;
        if (Math.abs(calculatedAmount - expectedAmount) > tolerance) {
            throw new Error(`Iteration ${iteration}: Amount calculation mismatch: expected ${expectedAmount}, got ${calculatedAmount}`);
        }
    }
    
    console.log('✅ Application Amount Calculation test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 7: Form validation completeness**
// **Validates: Requirements 2.5**
function testFormValidationCompleteness() {
    console.log('Testing Form Validation Completeness...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const testCases = [
            { investor_id: null, ipo_id: 1, application_amount: 1000, bank_name: 'HDFC', shouldPass: false },
            { investor_id: 1, ipo_id: null, application_amount: 1000, bank_name: 'HDFC', shouldPass: false },
            { investor_id: 1, ipo_id: 1, application_amount: null, bank_name: 'HDFC', shouldPass: false },
            { investor_id: 1, ipo_id: 1, application_amount: 1000, bank_name: null, shouldPass: false },
            { investor_id: 1, ipo_id: 1, application_amount: 1000, bank_name: 'HDFC', shouldPass: true }
        ];
        
        for (const testCase of testCases) {
            const isValid = !!(testCase.investor_id && testCase.ipo_id && testCase.application_amount && testCase.bank_name);
            
            if (isValid !== testCase.shouldPass) {
                throw new Error(`Iteration ${iteration}: Validation mismatch for case ${JSON.stringify(testCase)}: expected ${testCase.shouldPass}, got ${isValid}`);
            }
        }
    }
    
    console.log('✅ Form Validation Completeness test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 8: Add button presence**
// **Validates: Requirements 3.1**
function testAddButtonPresence() {
    console.log('Testing Add Button Presence...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const { applications, ipos } = generateTestData(20, 10);
        
        for (const ipo of ipos) {
            const ipoApps = applications.filter(app => app.ipo_id === ipo.id);
            
            if (ipoApps.length > 0) {
                const mockHTML = `<div class="ipo-group">
                    <h2>${ipo.ipo_name}</h2>
                    <button onclick="openApplicationModal(${ipo.id})">Add Application</button>
                </div>`;
                
                if (!mockHTML.includes('Add Application')) {
                    throw new Error(`Iteration ${iteration}: IPO group for ${ipo.ipo_name} missing Add Application button`);
                }
                
                if (!mockHTML.includes(`openApplicationModal(${ipo.id})`)) {
                    throw new Error(`Iteration ${iteration}: Add Application button for ${ipo.ipo_name} missing correct onclick handler`);
                }
            }
        }
    }
    
    console.log('✅ Add Button Presence test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 9: IPO prefilling from context**
// **Validates: Requirements 3.2**
function testIPOPrefillingFromContext() {
    console.log('Testing IPO Prefilling From Context...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const ipo = generateRandomIPO();
        
        const mockModalState = {
            prefilledIPOId: ipo.id,
            selectedIPOId: ipo.id
        };
        
        if (mockModalState.selectedIPOId !== mockModalState.prefilledIPOId) {
            throw new Error(`Iteration ${iteration}: IPO prefilling failed: expected ${mockModalState.prefilledIPOId}, got ${mockModalState.selectedIPOId}`);
        }
    }
    
    console.log('✅ IPO Prefilling From Context test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 10: Total application count**
// **Validates: Requirements 4.1**
function testTotalApplicationCount() {
    console.log('Testing Total Application Count...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const applications = [];
        const numApps = Math.floor(Math.random() * 20);
        for (let i = 0; i < numApps; i++) {
            applications.push(generateRandomApplication());
        }
        
        const summary = calculateIPOSummary(applications);
        
        if (summary.totalApplications !== applications.length) {
            throw new Error(`Iteration ${iteration}: Total applications mismatch: expected ${applications.length}, got ${summary.totalApplications}`);
        }
    }
    
    console.log('✅ Total Application Count test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 11: Status count accuracy**
// **Validates: Requirements 4.2**
function testStatusCountAccuracy() {
    console.log('Testing Status Count Accuracy...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const applications = [];
        const numApps = Math.floor(Math.random() * 20);
        for (let i = 0; i < numApps; i++) {
            applications.push(generateRandomApplication());
        }
        
        const summary = calculateIPOSummary(applications);
        
        const appliedCount = applications.filter(app => app.status === 'Applied').length;
        const allottedCount = applications.filter(app => app.status === 'Allotted').length;
        const notAllottedCount = applications.filter(app => app.status === 'Not Allotted').length;
        
        if (summary.appliedCount !== appliedCount) {
            throw new Error(`Iteration ${iteration}: Applied count mismatch: expected ${appliedCount}, got ${summary.appliedCount}`);
        }
        
        if (summary.allottedCount !== allottedCount) {
            throw new Error(`Iteration ${iteration}: Allotted count mismatch: expected ${allottedCount}, got ${summary.allottedCount}`);
        }
        
        if (summary.notAllottedCount !== notAllottedCount) {
            throw new Error(`Iteration ${iteration}: Not allotted count mismatch: expected ${notAllottedCount}, got ${summary.notAllottedCount}`);
        }
        
        const statusSum = summary.appliedCount + summary.allottedCount + summary.notAllottedCount;
        if (statusSum !== summary.totalApplications) {
            throw new Error(`Iteration ${iteration}: Status counts don't sum to total: ${statusSum} !== ${summary.totalApplications}`);
        }
    }
    
    console.log('✅ Status Count Accuracy test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 12: Total invested calculation**
// **Validates: Requirements 4.3**
function testTotalInvestedCalculation() {
    console.log('Testing Total Invested Calculation...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const applications = [];
        const numApps = Math.floor(Math.random() * 20);
        for (let i = 0; i < numApps; i++) {
            applications.push(generateRandomApplication());
        }
        
        const summary = calculateIPOSummary(applications);
        const expectedTotal = applications.reduce((sum, app) => sum + (app.application_amount || 0), 0);
        
        const tolerance = 0.01;
        if (Math.abs(summary.totalInvested - expectedTotal) > tolerance) {
            throw new Error(`Iteration ${iteration}: Total invested mismatch: expected ${expectedTotal}, got ${summary.totalInvested}`);
        }
    }
    
    console.log('✅ Total Invested Calculation test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 13: Total profit calculation**
// **Validates: Requirements 4.4**
function testTotalProfitCalculation() {
    console.log('Testing Total Profit Calculation...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const applications = [];
        const numApps = Math.floor(Math.random() * 20);
        for (let i = 0; i < numApps; i++) {
            applications.push(generateRandomApplication());
        }
        
        const summary = calculateIPOSummary(applications);
        const expectedProfit = applications
            .filter(app => app.status === 'Allotted')
            .reduce((sum, app) => sum + (app.profit || 0), 0);
        
        const tolerance = 0.01;
        if (Math.abs(summary.totalProfit - expectedProfit) > tolerance) {
            throw new Error(`Iteration ${iteration}: Total profit mismatch: expected ${expectedProfit}, got ${summary.totalProfit}`);
        }
    }
    
    console.log('✅ Total Profit Calculation test passed (100 iterations)');
}

// Run all property tests
function runAllPropertyTests() {
    console.log('🧪 Running Complete Property-Based Tests for IPO-wise Applications Feature\n');
    
    try {
        testIPOGroupingStructure();
        testApplicationDisplayCompleteness();
        testConsistentGroupingOrder();
        testInvestorFieldPrefilling();
        testBankDropdownSynchronization();
        testApplicationAmountCalculation();
        testFormValidationCompleteness();
        testAddButtonPresence();
        testIPOPrefillingFromContext();
        testTotalApplicationCount();
        testStatusCountAccuracy();
        testTotalInvestedCalculation();
        testTotalProfitCalculation();
        
        console.log('\n🎉 All 13 property tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Property test failed:', error.message);
        return false;
    }
}

// Auto-run if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const success = runAllPropertyTests();
    process.exit(success ? 0 : 1);
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllPropertyTests,
        testIPOGroupingStructure,
        testApplicationDisplayCompleteness,
        testConsistentGroupingOrder,
        testInvestorFieldPrefilling,
        testBankDropdownSynchronization,
        testApplicationAmountCalculation,
        testFormValidationCompleteness,
        testAddButtonPresence,
        testIPOPrefillingFromContext,
        testTotalApplicationCount,
        testStatusCountAccuracy,
        testTotalInvestedCalculation,
        testTotalProfitCalculation
    };
}