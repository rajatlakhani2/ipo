// Integration Test for IPO-wise Applications Feature
// Tests the actual implementation in script.js

// Load the functions from script.js by simulating browser environment
const fs = require('fs');

// Read the script.js file and extract the functions we need
const scriptContent = fs.readFileSync('script.js', 'utf8');

// Extract the groupApplicationsByIPO function
const groupFunctionMatch = scriptContent.match(/function groupApplicationsByIPO\([\s\S]*?\n}/);
if (!groupFunctionMatch) {
    console.error('❌ groupApplicationsByIPO function not found in script.js');
    process.exit(1);
}

// Extract the calculateIPOSummary function
const summaryFunctionMatch = scriptContent.match(/function calculateIPOSummary\([\s\S]*?\n}/);
if (!summaryFunctionMatch) {
    console.error('❌ calculateIPOSummary function not found in script.js');
    process.exit(1);
}

// Evaluate the functions
eval(groupFunctionMatch[0]);
eval(summaryFunctionMatch[0]);

// Test data
const testApplications = [
    {
        id: 1,
        investor_id: 1,
        ipo_id: 1,
        application_amount: 10000,
        status: 'Applied',
        payment_status: 'Pending',
        bank_name: 'HDFC Bank',
        profit: 0
    },
    {
        id: 2,
        investor_id: 2,
        ipo_id: 1,
        application_amount: 15000,
        status: 'Allotted',
        payment_status: 'Received',
        bank_name: 'ICICI Bank',
        profit: 2500
    },
    {
        id: 3,
        investor_id: 3,
        ipo_id: 2,
        application_amount: 20000,
        status: 'Not Allotted',
        payment_status: 'Pending',
        bank_name: 'SBI',
        profit: 0
    }
];

const testIPOs = [
    {
        id: 1,
        ipo_name: 'Test IPO 1',
        ipo_type: 'Mainboard',
        status: 'Open',
        num_shares: 100,
        purchase_price_per_share: 100
    },
    {
        id: 2,
        ipo_name: 'Test IPO 2',
        ipo_type: 'SME',
        status: 'Closed',
        num_shares: 50,
        purchase_price_per_share: 400
    }
];

console.log('🧪 Running IPO Integration Tests\n');

try {
    // Test 1: Grouping functionality
    console.log('Testing IPO grouping...');
    const groups = groupApplicationsByIPO(testApplications, testIPOs);
    
    if (groups.size !== 2) {
        throw new Error(`Expected 2 groups, got ${groups.size}`);
    }
    
    if (!groups.has(1) || !groups.has(2)) {
        throw new Error('Missing expected IPO groups');
    }
    
    const group1 = groups.get(1);
    if (group1.applications.length !== 2) {
        throw new Error(`IPO 1 should have 2 applications, got ${group1.applications.length}`);
    }
    
    const group2 = groups.get(2);
    if (group2.applications.length !== 1) {
        throw new Error(`IPO 2 should have 1 application, got ${group2.applications.length}`);
    }
    
    console.log('✅ IPO grouping test passed');
    
    // Test 2: Summary calculation
    console.log('Testing summary calculation...');
    const summary1 = calculateIPOSummary(group1.applications);
    
    if (summary1.totalApplications !== 2) {
        throw new Error(`Expected 2 total applications, got ${summary1.totalApplications}`);
    }
    
    if (summary1.appliedCount !== 1) {
        throw new Error(`Expected 1 applied application, got ${summary1.appliedCount}`);
    }
    
    if (summary1.allottedCount !== 1) {
        throw new Error(`Expected 1 allotted application, got ${summary1.allottedCount}`);
    }
    
    if (summary1.totalInvested !== 25000) {
        throw new Error(`Expected total invested 25000, got ${summary1.totalInvested}`);
    }
    
    if (summary1.totalProfit !== 2500) {
        throw new Error(`Expected total profit 2500, got ${summary1.totalProfit}`);
    }
    
    console.log('✅ Summary calculation test passed');
    
    // Test 3: Edge cases
    console.log('Testing edge cases...');
    
    // Empty applications
    const emptyGroups = groupApplicationsByIPO([], testIPOs);
    if (emptyGroups.size !== 0) {
        throw new Error(`Expected 0 groups for empty applications, got ${emptyGroups.size}`);
    }
    
    // Empty summary
    const emptySummary = calculateIPOSummary([]);
    if (emptySummary.totalApplications !== 0) {
        throw new Error(`Expected 0 total applications for empty array, got ${emptySummary.totalApplications}`);
    }
    
    console.log('✅ Edge cases test passed');
    
    console.log('\n🎉 All IPO integration tests passed!');
    console.log('\n📊 Test Results:');
    console.log(`   • IPO Grouping: ✅ Working correctly`);
    console.log(`   • Summary Calculation: ✅ Working correctly`);
    console.log(`   • Edge Cases: ✅ Handled properly`);
    console.log(`   • Functions Found: ✅ Both functions exist in script.js`);
    
} catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    process.exit(1);
}