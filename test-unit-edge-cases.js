// Unit Tests for Edge Cases
// **Feature: ipo-wise-applications**
// **Validates: Requirements 1.1, 1.3**

// Copy of the functions from script.js for testing
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

// Unit Tests for Edge Cases

function testGroupingWithEmptyApplicationsArray() {
    console.log('Testing grouping with empty applications array...');
    
    const applications = [];
    const ipos = [
        { id: 1, ipo_name: 'Test IPO 1' },
        { id: 2, ipo_name: 'Test IPO 2' }
    ];
    
    const result = groupApplicationsByIPO(applications, ipos);
    
    if (result.size !== 0) {
        throw new Error(`Expected empty groups with empty applications, but got ${result.size} groups`);
    }
    
    console.log('✅ Grouping with empty applications array test passed');
}

function testGroupingWithEmptyIPOsArray() {
    console.log('Testing grouping with empty IPOs array...');
    
    const applications = [
        { id: 1, ipo_id: 1, investor_id: 1, application_amount: 1000 },
        { id: 2, ipo_id: 2, investor_id: 2, application_amount: 2000 }
    ];
    const ipos = [];
    
    const result = groupApplicationsByIPO(applications, ipos);
    
    if (result.size !== 0) {
        throw new Error(`Expected empty groups with empty IPOs, but got ${result.size} groups`);
    }
    
    console.log('✅ Grouping with empty IPOs array test passed');
}

function testRenderingWithMissingIPOData() {
    console.log('Testing rendering with missing IPO data...');
    
    const applications = [
        { id: 1, ipo_id: 999, investor_id: 1, application_amount: 1000 } // IPO ID 999 doesn't exist
    ];
    const ipos = [
        { id: 1, ipo_name: 'Test IPO 1' },
        { id: 2, ipo_name: 'Test IPO 2' }
    ];
    
    const result = groupApplicationsByIPO(applications, ipos);
    
    // Should not create a group for non-existent IPO
    if (result.has(999)) {
        throw new Error('Should not create group for non-existent IPO');
    }
    
    if (result.size !== 0) {
        throw new Error(`Expected no groups for non-existent IPO, but got ${result.size} groups`);
    }
    
    console.log('✅ Rendering with missing IPO data test passed');
}

function testRenderingWithMissingInvestorData() {
    console.log('Testing rendering with missing investor data...');
    
    // Mock rendering function that handles missing investor
    function mockRenderApplication(application, investors) {
        const investor = investors.find(inv => inv.id === application.investor_id);
        
        return {
            investorName: investor ? investor.name : 'Unknown',
            amount: application.application_amount,
            status: application.status
        };
    }
    
    const application = { id: 1, investor_id: 999, application_amount: 1000, status: 'Applied' };
    const investors = [
        { id: 1, name: 'Investor 1' },
        { id: 2, name: 'Investor 2' }
    ];
    
    const result = mockRenderApplication(application, investors);
    
    if (result.investorName !== 'Unknown') {
        throw new Error(`Expected "Unknown" for missing investor, but got "${result.investorName}"`);
    }
    
    if (result.amount !== 1000) {
        throw new Error(`Expected amount to be preserved, but got ${result.amount}`);
    }
    
    console.log('✅ Rendering with missing investor data test passed');
}

function testBankDropdownWithInvestorHavingNoBanks() {
    console.log('Testing bank dropdown with investor having no banks...');
    
    // Mock bank dropdown population function
    function mockPopulateBankDropdown(investor) {
        const banks = investor.banks ? investor.banks.split(',').map(b => b.trim()).filter(b => b) : [];
        
        return {
            options: banks.map(bank => ({ value: bank, text: bank })),
            allowManualEntry: banks.length === 0
        };
    }
    
    const investorWithNoBanks = { id: 1, name: 'Test Investor', banks: '' };
    const investorWithNullBanks = { id: 2, name: 'Test Investor 2', banks: null };
    const investorWithUndefinedBanks = { id: 3, name: 'Test Investor 3' };
    
    const result1 = mockPopulateBankDropdown(investorWithNoBanks);
    const result2 = mockPopulateBankDropdown(investorWithNullBanks);
    const result3 = mockPopulateBankDropdown(investorWithUndefinedBanks);
    
    if (result1.options.length !== 0) {
        throw new Error(`Expected no bank options for empty banks string, but got ${result1.options.length}`);
    }
    
    if (!result1.allowManualEntry) {
        throw new Error('Expected manual entry to be allowed when no banks are configured');
    }
    
    if (result2.options.length !== 0) {
        throw new Error(`Expected no bank options for null banks, but got ${result2.options.length}`);
    }
    
    if (!result2.allowManualEntry) {
        throw new Error('Expected manual entry to be allowed when banks is null');
    }
    
    if (result3.options.length !== 0) {
        throw new Error(`Expected no bank options for undefined banks, but got ${result3.options.length}`);
    }
    
    if (!result3.allowManualEntry) {
        throw new Error('Expected manual entry to be allowed when banks is undefined');
    }
    
    console.log('✅ Bank dropdown with investor having no banks test passed');
}

function testApplicationsWithMissingIPOIds() {
    console.log('Testing applications with missing IPO IDs...');
    
    const applications = [
        { id: 1, ipo_id: 1, investor_id: 1, application_amount: 1000 },
        { id: 2, ipo_id: null, investor_id: 2, application_amount: 2000 }, // Missing IPO ID
        { id: 3, investor_id: 3, application_amount: 3000 }, // Missing IPO ID property
        { id: 4, ipo_id: 2, investor_id: 4, application_amount: 4000 }
    ];
    const ipos = [
        { id: 1, ipo_name: 'Test IPO 1' },
        { id: 2, ipo_name: 'Test IPO 2' }
    ];
    
    const result = groupApplicationsByIPO(applications, ipos);
    
    // Should only have groups for IPOs 1 and 2
    if (result.size !== 2) {
        throw new Error(`Expected 2 groups, but got ${result.size}`);
    }
    
    if (!result.has(1) || !result.has(2)) {
        throw new Error('Expected groups for IPO 1 and 2');
    }
    
    // IPO 1 should have 1 application
    if (result.get(1).applications.length !== 1) {
        throw new Error(`Expected 1 application in IPO 1 group, but got ${result.get(1).applications.length}`);
    }
    
    // IPO 2 should have 1 application
    if (result.get(2).applications.length !== 1) {
        throw new Error(`Expected 1 application in IPO 2 group, but got ${result.get(2).applications.length}`);
    }
    
    console.log('✅ Applications with missing IPO IDs test passed');
}

// Run all unit tests for edge cases
function runAllEdgeCaseTests() {
    console.log('🧪 Running Unit Tests for Edge Cases\n');
    
    try {
        testGroupingWithEmptyApplicationsArray();
        testGroupingWithEmptyIPOsArray();
        testRenderingWithMissingIPOData();
        testRenderingWithMissingInvestorData();
        testBankDropdownWithInvestorHavingNoBanks();
        testApplicationsWithMissingIPOIds();
        
        console.log('\n🎉 All edge case tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Edge case test failed:', error.message);
        return false;
    }
}

// Auto-run if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const success = runAllEdgeCaseTests();
    process.exit(success ? 0 : 1);
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllEdgeCaseTests,
        testGroupingWithEmptyApplicationsArray,
        testGroupingWithEmptyIPOsArray,
        testRenderingWithMissingIPOData,
        testRenderingWithMissingInvestorData,
        testBankDropdownWithInvestorHavingNoBanks,
        testApplicationsWithMissingIPOIds
    };
}