// Test runner for IPO-wise Applications Property Tests
const fs = require('fs');

// Load the functions from script.js
const scriptContent = fs.readFileSync('script.js', 'utf8');

// Extract the functions we need to test using more robust regex
const groupApplicationsByIPOMatch = scriptContent.match(/function groupApplicationsByIPO\([^}]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/);
const calculateIPOSummaryMatch = scriptContent.match(/function calculateIPOSummary\([^}]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/);

if (!groupApplicationsByIPOMatch || !calculateIPOSummaryMatch) {
    console.error('Could not find required functions in script.js');
    console.log('Looking for groupApplicationsByIPO and calculateIPOSummary functions...');
    
    // Try alternative extraction
    const lines = scriptContent.split('\n');
    let groupingFunctionLines = [];
    let summaryFunctionLines = [];
    let inGroupingFunction = false;
    let inSummaryFunction = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('function groupApplicationsByIPO')) {
            inGroupingFunction = true;
            braceCount = 0;
        }
        
        if (line.includes('function calculateIPOSummary')) {
            inSummaryFunction = true;
            braceCount = 0;
        }
        
        if (inGroupingFunction) {
            groupingFunctionLines.push(line);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0 && line.includes('}')) {
                inGroupingFunction = false;
            }
        }
        
        if (inSummaryFunction) {
            summaryFunctionLines.push(line);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0 && line.includes('}')) {
                inSummaryFunction = false;
            }
        }
    }
    
    if (groupingFunctionLines.length > 0 && summaryFunctionLines.length > 0) {
        console.log('Found functions using line-by-line extraction');
        eval(groupingFunctionLines.join('\n'));
        eval(summaryFunctionLines.join('\n'));
    } else {
        console.error('Could not extract functions');
        process.exit(1);
    }
} else {
    // Create a test environment
    eval(groupApplicationsByIPOMatch[0]);
    eval(calculateIPOSummaryMatch[0]);
}

// Load and run the property tests
const testContent = fs.readFileSync('test-properties-simple.js', 'utf8');
eval(testContent);

// Run the tests
const success = runAllPropertyTests();
process.exit(success ? 0 : 1);