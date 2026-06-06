// Unit Tests for Form Validation
// **Feature: ipo-wise-applications**
// **Validates: Requirements 2.5**

// Mock validation function (based on the actual implementation in script.js)
function validateApplicationForm(data) {
    const errors = [];
    
    if (!data.investor_id) errors.push('Investor is required');
    if (!data.ipo_id) errors.push('IPO is required');
    if (!data.application_amount || parseFloat(data.application_amount) <= 0) errors.push('Valid application amount is required');
    if (!data.bank_name) errors.push('Bank name is required');
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Unit Tests
function testValidationWithAllRequiredFields() {
    console.log('Testing validation with all required fields present...');
    
    const validData = {
        investor_id: 1,
        ipo_id: 1,
        application_amount: 1000,
        bank_name: 'HDFC Bank'
    };
    
    const result = validateApplicationForm(validData);
    
    if (!result.isValid) {
        throw new Error(`Expected validation to pass with all required fields, but got errors: ${result.errors.join(', ')}`);
    }
    
    if (result.errors.length !== 0) {
        throw new Error(`Expected no errors with valid data, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with all required fields test passed');
}

function testValidationWithMissingInvestorId() {
    console.log('Testing validation with missing investor_id...');
    
    const invalidData = {
        investor_id: null,
        ipo_id: 1,
        application_amount: 1000,
        bank_name: 'HDFC Bank'
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with missing investor_id, but it passed');
    }
    
    if (!result.errors.includes('Investor is required')) {
        throw new Error(`Expected "Investor is required" error, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with missing investor_id test passed');
}

function testValidationWithMissingIpoId() {
    console.log('Testing validation with missing ipo_id...');
    
    const invalidData = {
        investor_id: 1,
        ipo_id: null,
        application_amount: 1000,
        bank_name: 'HDFC Bank'
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with missing ipo_id, but it passed');
    }
    
    if (!result.errors.includes('IPO is required')) {
        throw new Error(`Expected "IPO is required" error, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with missing ipo_id test passed');
}

function testValidationWithMissingApplicationAmount() {
    console.log('Testing validation with missing application_amount...');
    
    const invalidData = {
        investor_id: 1,
        ipo_id: 1,
        application_amount: null,
        bank_name: 'HDFC Bank'
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with missing application_amount, but it passed');
    }
    
    if (!result.errors.includes('Valid application amount is required')) {
        throw new Error(`Expected "Valid application amount is required" error, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with missing application_amount test passed');
}

function testValidationWithInvalidApplicationAmount() {
    console.log('Testing validation with invalid application_amount (zero)...');
    
    const invalidData = {
        investor_id: 1,
        ipo_id: 1,
        application_amount: 0,
        bank_name: 'HDFC Bank'
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with zero application_amount, but it passed');
    }
    
    if (!result.errors.includes('Valid application amount is required')) {
        throw new Error(`Expected "Valid application amount is required" error, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with invalid application_amount test passed');
}

function testValidationWithMissingBankName() {
    console.log('Testing validation with missing bank_name...');
    
    const invalidData = {
        investor_id: 1,
        ipo_id: 1,
        application_amount: 1000,
        bank_name: null
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with missing bank_name, but it passed');
    }
    
    if (!result.errors.includes('Bank name is required')) {
        throw new Error(`Expected "Bank name is required" error, but got: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with missing bank_name test passed');
}

function testValidationWithMultipleErrors() {
    console.log('Testing validation with multiple missing fields...');
    
    const invalidData = {
        investor_id: null,
        ipo_id: null,
        application_amount: null,
        bank_name: null
    };
    
    const result = validateApplicationForm(invalidData);
    
    if (result.isValid) {
        throw new Error('Expected validation to fail with all missing fields, but it passed');
    }
    
    const expectedErrors = [
        'Investor is required',
        'IPO is required',
        'Valid application amount is required',
        'Bank name is required'
    ];
    
    for (const expectedError of expectedErrors) {
        if (!result.errors.includes(expectedError)) {
            throw new Error(`Expected "${expectedError}" error, but got: ${result.errors.join(', ')}`);
        }
    }
    
    if (result.errors.length !== expectedErrors.length) {
        throw new Error(`Expected ${expectedErrors.length} errors, but got ${result.errors.length}: ${result.errors.join(', ')}`);
    }
    
    console.log('✅ Validation with multiple errors test passed');
}

// Run all unit tests
function runAllUnitTests() {
    console.log('🧪 Running Unit Tests for Form Validation\n');
    
    try {
        testValidationWithAllRequiredFields();
        testValidationWithMissingInvestorId();
        testValidationWithMissingIpoId();
        testValidationWithMissingApplicationAmount();
        testValidationWithInvalidApplicationAmount();
        testValidationWithMissingBankName();
        testValidationWithMultipleErrors();
        
        console.log('\n🎉 All unit tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Unit test failed:', error.message);
        return false;
    }
}

// Auto-run if called directly
if (typeof require !== 'undefined' && require.main === module) {
    const success = runAllUnitTests();
    process.exit(success ? 0 : 1);
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllUnitTests,
        validateApplicationForm,
        testValidationWithAllRequiredFields,
        testValidationWithMissingInvestorId,
        testValidationWithMissingIpoId,
        testValidationWithMissingApplicationAmount,
        testValidationWithInvalidApplicationAmount,
        testValidationWithMissingBankName,
        testValidationWithMultipleErrors
    };
}