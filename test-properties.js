// Property-Based Tests for IPO-wise Applications Feature
// Using fast-check library for property-based testing

// Mock fast-check for now - in a real implementation, you would install fast-check via npm
const fc = {
    // Simple mock implementation for demonstration
    array: (generator, options = {}) => ({
        generate: () => {
            const length = Math.floor(Math.random() * (options.maxLength || 10));
            const result = [];
            for (let i = 0; i < length; i++) {
                result.push(generator.generate());
            }
            return result;
        }
    }),
    
    record: (schema) => ({
        generate: () => {
            const result = {};
            for (const [key, generator] of Object.entries(schema)) {
                result[key] = generator.generate();
            }
            return result;
        }
    }),
    
    integer: (options = {}) => ({
        generate: () => {
            const min = options.min || 0;
            const max = options.max || 100;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }),
    
    string: () => ({
        generate: () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < Math.floor(Math.random() * 10) + 1; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    }),
    
    float: (options = {}) => ({
        generate: () => {
            const min = options.min || 0;
            const max = options.max || 1000;
            return Math.random() * (max - min) + min;
        }
    }),
    
    constantFrom: (...values) => ({
        generate: () => values[Math.floor(Math.random() * values.length)]
    }),
    
    assert: (property, options = {}) => {
        const iterations = options.numRuns || 100;
        console.log(`Running property test with ${iterations} iterations...`);
        
        for (let i = 0; i < iterations; i++) {
            try {
                const result = property();
                if (!result) {
                    throw new Error(`Property failed on iteration ${i + 1}`);
                }
            } catch (error) {
                console.error(`Property test failed on iteration ${i + 1}:`, error);
                throw error;
            }
        }
        console.log(`✅ Property test passed all ${iterations} iterations`);
    }
};

// Test data generators
const applicationGenerator = fc.record({
    id: fc.integer({ min: 1, max: 1000 }),
    investor_id: fc.integer({ min: 1, max: 100 }),
    ipo_id: fc.integer({ min: 1, max: 50 }),
    application_amount: fc.float({ min: 1000, max: 100000 }),
    status: fc.constantFrom('Applied', 'Allotted', 'Not Allotted'),
    payment_status: fc.constantFrom('Pending', 'Received'),
    bank_name: fc.string(),
    profit: fc.float({ min: -10000, max: 50000 })
});

const ipoGenerator = fc.record({
    id: fc.integer({ min: 1, max: 50 }),
    ipo_name: fc.string(),
    ipo_type: fc.constantFrom('Mainboard', 'SME'),
    status: fc.constantFrom('Open', 'Closed'),
    num_shares: fc.integer({ min: 1, max: 1000 }),
    purchase_price_per_share: fc.float({ min: 10, max: 1000 }),
    sale_price_per_share: fc.float({ min: 10, max: 2000 }),
    profit: fc.float({ min: -50000, max: 100000 })
});

const investorGenerator = fc.record({
    id: fc.integer({ min: 1, max: 100 }),
    name: fc.string(),
    upi: fc.string(),
    family_group: fc.constantFrom('Family', 'Friends', 'Relatives', 'Self'),
    banks: fc.string() // comma-separated banks
});

// **Feature: ipo-wise-applications, Property 1: IPO grouping structure**
// **Validates: Requirements 1.1, 1.2, 1.4**
function testIPOGroupingStructure() {
    fc.assert(() => {
        // Generate random test data
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        const ipos = fc.array(ipoGenerator, { maxLength: 10 }).generate();
        
        // Ensure we have valid IPO IDs in applications
        if (ipos.length > 0 && applications.length > 0) {
            applications.forEach(app => {
                app.ipo_id = ipos[Math.floor(Math.random() * ipos.length)].id;
            });
        }
        
        // Test the grouping function
        const groups = groupApplicationsByIPO(applications, ipos);
        
        // Property 1: Each IPO with applications should appear exactly once
        const iposWithApps = new Set(applications.map(app => app.ipo_id));
        const groupKeys = new Set(groups.keys());
        
        // Every IPO that has applications should be in the groups
        for (const ipoId of iposWithApps) {
            if (!groupKeys.has(ipoId)) {
                console.error(`IPO ${ipoId} has applications but is not in groups`);
                return false;
            }
        }
        
        // Every group should have at least one application
        for (const [ipoId, group] of groups) {
            if (!group.applications || group.applications.length === 0) {
                console.error(`IPO group ${ipoId} has no applications`);
                return false;
            }
            
            // Every application in the group should belong to this IPO
            for (const app of group.applications) {
                if (app.ipo_id !== ipoId) {
                    console.error(`Application ${app.id} in IPO group ${ipoId} has wrong ipo_id: ${app.ipo_id}`);
                    return false;
                }
            }
            
            // Group should have IPO object
            if (!group.ipo) {
                console.error(`IPO group ${ipoId} missing IPO object`);
                return false;
            }
        }
        
        // IPOs without applications should not appear in groups
        for (const ipo of ipos) {
            const hasApplications = applications.some(app => app.ipo_id === ipo.id);
            const inGroups = groups.has(ipo.id);
            
            if (!hasApplications && inGroups) {
                console.error(`IPO ${ipo.id} has no applications but appears in groups`);
                return false;
            }
        }
        
        return true;
    }, { numRuns: 100 });
}

// **Feature: ipo-wise-applications, Property 10: Total application count**
// **Validates: Requirements 4.1**
function testTotalApplicationCount() {
    fc.assert(() => {
        // Generate random applications for a single IPO
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Property: totalApplications should equal array length
        if (summary.totalApplications !== applications.length) {
            console.error(`Total applications mismatch: expected ${applications.length}, got ${summary.totalApplications}`);
            return false;
        }
        
        return true;
    }, { numRuns: 100 });
}

// **Feature: ipo-wise-applications, Property 11: Status count accuracy**
// **Validates: Requirements 4.2**
function testStatusCountAccuracy() {
    fc.assert(() => {
        // Generate random applications
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Count statuses manually
        const appliedCount = applications.filter(app => app.status === 'Applied').length;
        const allottedCount = applications.filter(app => app.status === 'Allotted').length;
        const notAllottedCount = applications.filter(app => app.status === 'Not Allotted').length;
        
        // Property: Status counts should match manual counts
        if (summary.appliedCount !== appliedCount) {
            console.error(`Applied count mismatch: expected ${appliedCount}, got ${summary.appliedCount}`);
            return false;
        }
        
        if (summary.allottedCount !== allottedCount) {
            console.error(`Allotted count mismatch: expected ${allottedCount}, got ${summary.allottedCount}`);
            return false;
        }
        
        if (summary.notAllottedCount !== notAllottedCount) {
            console.error(`Not allotted count mismatch: expected ${notAllottedCount}, got ${summary.notAllottedCount}`);
            return false;
        }
        
        // Property: Sum of status counts should equal total
        const statusSum = summary.appliedCount + summary.allottedCount + summary.notAllottedCount;
        if (statusSum !== summary.totalApplications) {
            console.error(`Status counts don't sum to total: ${statusSum} !== ${summary.totalApplications}`);
            return false;
        }
        
        return true;
    }, { numRuns: 100 });
}

// **Feature: ipo-wise-applications, Property 12: Total invested calculation**
// **Validates: Requirements 4.3**
function testTotalInvestedCalculation() {
    fc.assert(() => {
        // Generate random applications
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Calculate total invested manually
        const expectedTotal = applications.reduce((sum, app) => sum + (app.application_amount || 0), 0);
        
        // Property: totalInvested should equal sum of all application amounts
        const tolerance = 0.01; // Allow for floating point precision issues
        if (Math.abs(summary.totalInvested - expectedTotal) > tolerance) {
            console.error(`Total invested mismatch: expected ${expectedTotal}, got ${summary.totalInvested}`);
            return false;
        }
        
        return true;
    }, { numRuns: 100 });
}

// **Feature: ipo-wise-applications, Property 13: Total profit calculation**
// **Validates: Requirements 4.4**
function testTotalProfitCalculation() {
    fc.assert(() => {
        // Generate random applications
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        
        // Test the summary calculation
        const summary = calculateIPOSummary(applications);
        
        // Calculate total profit manually (only for allotted applications)
        const expectedProfit = applications
            .filter(app => app.status === 'Allotted')
            .reduce((sum, app) => sum + (app.profit || 0), 0);
        
        // Property: totalProfit should equal sum of profit for allotted applications only
        const tolerance = 0.01; // Allow for floating point precision issues
        if (Math.abs(summary.totalProfit - expectedProfit) > tolerance) {
            console.error(`Total profit mismatch: expected ${expectedProfit}, got ${summary.totalProfit}`);
            return false;
        }
        
        return true;
    }, { numRuns: 100 });
}

// **Feature: ipo-wise-applications, Property 3: Consistent grouping order**
// **Validates: Requirements 1.5**
function testConsistentGroupingOrder() {
    fc.assert(() => {
        // Generate random test data
        const applications = fc.array(applicationGenerator, { maxLength: 20 }).generate();
        const ipos = fc.array(ipoGenerator, { maxLength: 10 }).generate();
        
        // Ensure we have valid IPO IDs in applications
        if (ipos.length > 0 && applications.length > 0) {
            applications.forEach(app => {
                app.ipo_id = ipos[Math.floor(Math.random() * ipos.length)].id;
            });
        }
        
        // Test the grouping function multiple times with same input
        const groups1 = groupApplicationsByIPO(applications, ipos);
        const groups2 = groupApplicationsByIPO(applications, ipos);
        
        // Convert to arrays to compare order
        const keys1 = Array.from(groups1.keys());
        const keys2 = Array.from(groups2.keys());
        
        // Property: Same input should produce same order
        if (keys1.length !== keys2.length) {
            console.error(`Different number of groups: ${keys1.length} vs ${keys2.length}`);
            return false;
        }
        
        for (let i = 0; i < keys1.length; i++) {
            if (keys1[i] !== keys2[i]) {
                console.error(`Different order at position ${i}: ${keys1[i]} vs ${keys2[i]}`);
                return false;
            }
        }
        
        return true;
    }, { numRuns: 100 });
}

// Run all property tests
function runAllPropertyTests() {
    console.log('🧪 Running Property-Based Tests for IPO-wise Applications Feature\n');
    
    try {
        console.log('1. Testing IPO Grouping Structure...');
        testIPOGroupingStructure();
        
        console.log('\n2. Testing Total Application Count...');
        testTotalApplicationCount();
        
        console.log('\n3. Testing Status Count Accuracy...');
        testStatusCountAccuracy();
        
        console.log('\n4. Testing Total Invested Calculation...');
        testTotalInvestedCalculation();
        
        console.log('\n5. Testing Total Profit Calculation...');
        testTotalProfitCalculation();
        
        console.log('\n6. Testing Consistent Grouping Order...');
        testConsistentGroupingOrder();
        
        console.log('\n🎉 All property tests passed!');
        
    } catch (error) {
        console.error('\n❌ Property test failed:', error.message);
        throw error;
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