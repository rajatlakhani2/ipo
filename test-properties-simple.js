// Simple Property-Based Tests for IPO-wise Applications Feature
// Using basic JavaScript without external dependencies

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
        ipos.push(generateRandomIPO());
    }
    
    const applications = [];
    for (let i = 0; i < numApplications; i++) {
        const app = generateRandomApplication();
        // Ensure valid IPO IDs
        if (ipos.length > 0) {
            app.ipo_id = ipos[Math.floor(Math.random() * ipos.length)].id;
        }
        applications.push(app);
    }
    
    return { applications, ipos };
}

// **Feature: ipo-wise-applications, Property 1: IPO grouping structure**
// **Validates: Requirements 1.1, 1.2, 1.4**
function testIPOGroupingStructure() {
    console.log('Testing IPO Grouping Structure...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const { applications, ipos } = generateTestData(20, 10);
        
        // Test the grouping function
        const groups = groupApplicationsByIPO(applications, ipos);
        
        // Property 1: Each IPO with applications should appear exactly once
        const iposWithApps = new Set(applications.map(app => app.ipo_id));
        const groupKeys = new Set(groups.keys());
        
        // Every IPO that has applications should be in the groups
        for (const ipoId of iposWithApps) {
            if (!groupKeys.has(ipoId)) {
                throw new Error(`IPO ${ipoId} has applications but is not in groups`);
            }
        }
        
        // Every group should have at least one application
        for (const [ipoId, group] of groups) {
            if (!group.applications || group.applications.length === 0) {
                throw new Error(`IPO group ${ipoId} has no applications`);
            }
            
            // Every application in the group should belong to this IPO
            for (const app of group.applications) {
                if (app.ipo_id !== ipoId) {
                    throw new Error(`Application ${app.id} in IPO group ${ipoId} has wrong ipo_id: ${app.ipo_id}`);
                }
            }
            
            // Group should have IPO object
            if (!group.ipo) {
                throw new Error(`IPO group ${ipoId} missing IPO object`);
            }
        }
        
        // IPOs without applications should not appear in groups
        for (const ipo of ipos) {
            const hasApplications = applications.some(app => app.ipo_id === ipo.id);
            const inGroups = groups.has(ipo.id);
            
            if (!hasApplications && inGroups) {
                throw new Error(`IPO ${ipo.id} has no applications but appears in groups`);
            }
        }
    }
    
    console.log('✅ IPO Grouping Structure test passed (100 iterations)');
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
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Property: totalApplications should equal array length
        if (summary.totalApplications !== applications.length) {
            throw new Error(`Total applications mismatch: expected ${applications.length}, got ${summary.totalApplications}`);
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
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Count statuses manually
        const appliedCount = applications.filter(app => app.status === 'Applied').length;
        const allottedCount = applications.filter(app => app.status === 'Allotted').length;
        const notAllottedCount = applications.filter(app => app.status === 'Not Allotted').length;
        
        // Property: Status counts should match manual counts
        if (summary.appliedCount !== appliedCount) {
            throw new Error(`Applied count mismatch: expected ${appliedCount}, got ${summary.appliedCount}`);
        }
        
        if (summary.allottedCount !== allottedCount) {
            throw new Error(`Allotted count mismatch: expected ${allottedCount}, got ${summary.allottedCount}`);
        }
        
        if (summary.notAllottedCount !== notAllottedCount) {
            throw new Error(`Not allotted count mismatch: expected ${notAllottedCount}, got ${summary.notAllottedCount}`);
        }
        
        // Property: Sum of status counts should equal total
        const statusSum = summary.appliedCount + summary.allottedCount + summary.notAllottedCount;
        if (statusSum !== summary.totalApplications) {
            throw new Error(`Status counts don't sum to total: ${statusSum} !== ${summary.totalApplications}`);
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
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Calculate total invested manually
        const expectedTotal = applications.reduce((sum, app) => sum + (app.application_amount || 0), 0);
        
        // Property: totalInvested should equal sum of all application amounts
        const tolerance = 0.01; // Allow for floating point precision issues
        if (Math.abs(summary.totalInvested - expectedTotal) > tolerance) {
            throw new Error(`Total invested mismatch: expected ${expectedTotal}, got ${summary.totalInvested}`);
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
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Calculate total profit manually (only for allotted applications)
        const expectedProfit = applications
            .filter(app => app.status === 'Allotted')
            .reduce((sum, app) => sum + (app.profit || 0), 0);
        
        // Property: totalProfit should equal sum of profit for allotted applications only
        const tolerance = 0.01; // Allow for floating point precision issues
        if (Math.abs(summary.totalProfit - expectedProfit) > tolerance) {
            throw new Error(`Total profit mismatch: expected ${expectedProfit}, got ${summary.totalProfit}`);
        }
    }
    
    console.log('✅ Total Profit Calculation test passed (100 iterations)');
}

// **Feature: ipo-wise-applications, Property 3: Consistent grouping order**
// **Validates: Requirements 1.5**
function testConsistentGroupingOrder() {
    console.log('Testing Consistent Grouping Order...');
    
    for (let iteration = 0; iteration < 100; iteration++) {
        const { applications, ipos } = generateTestData(20, 10);
        
        // Test the grouping function multiple times with same input
        const groups1 = groupApplicationsByIPO(applications, ipos);
        const groups2 = groupApplicationsByIPO(applications, ipos);
        
        // Convert to arrays to compare order
        const keys1 = Array.from(groups1.keys());
        const keys2 = Array.from(groups2.keys());
        
        // Property: Same input should produce same order
        if (keys1.length !== keys2.length) {
            throw new Error(`Different number of groups: ${keys1.length} vs ${keys2.length}`);
        }
        
        for (let i = 0; i < keys1.length; i++) {
            if (keys1[i] !== keys2[i]) {
                throw new Error(`Different order at position ${i}: ${keys1[i]} vs ${keys2[i]}`);
            }
        }
    }
    
    console.log('✅ Consistent Grouping Order test passed (100 iterations)');
}

// Run all property tests
function runAllPropertyTests() {
    console.log('🧪 Running Property-Based Tests for IPO-wise Applications Feature\n');
    
    try {
        testIPOGroupingStructure();
        testTotalApplicationCount();
        testStatusCountAccuracy();
        testTotalInvestedCalculation();
        testTotalProfitCalculation();
        testConsistentGroupingOrder();
        
        console.log('\n🎉 All property tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Property test failed:', error.message);
        return false;
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllPropertyTests,
        testIPOGroupingStructure,
        testTotalApplicationCount,
        testStatusCountAccuracy,
        testTotalInvestedCalculation,
        testTotalProfitCalculation,
        testConsistentGroupingOrder
    };
}

// Auto-run if called directly
if (typeof window === 'undefined' && require.main === module) {
    runAllPropertyTests();
}