# Design Document

## Overview

This feature redesigns the Applications tab to organize applications by IPO rather than displaying them in a flat list. The new design groups applications under their respective IPO headings, displays summary statistics for each IPO group, and provides context-aware form prefilling to streamline data entry. The implementation focuses on frontend JavaScript modifications to reorganize the display logic and enhance the user experience without requiring backend API changes.

## Architecture

The solution is primarily a frontend enhancement that reorganizes how existing application data is displayed and how forms are initialized. The architecture follows the existing pattern:

- **Frontend (JavaScript)**: Handles data fetching, grouping, rendering, and form management
- **Backend (Flask API)**: Provides existing endpoints for applications, investors, and IPOs (no changes required)
- **Data Flow**: Fetch all applications → Group by IPO → Render grouped view with summaries

### Component Interaction

```
User → Applications Tab → Fetch Data (API) → Group by IPO → Render Grouped View
                                                              ↓
                                                    Display IPO Groups with:
                                                    - Summary Statistics
                                                    - Application List
                                                    - Add Button (prefilled)
```

## Components and Interfaces

### 1. Applications View Renderer

**Responsibility**: Transform flat application list into IPO-grouped structure and render HTML

**Key Functions**:
- `loadApplicationsView()`: Main entry point, fetches data and orchestrates rendering
- `groupApplicationsByIPO(applications, ipos)`: Groups applications by IPO ID
- `calculateIPOSummary(applications)`: Computes summary statistics for an IPO group
- `renderIPOGroup(ipo, applications, summary)`: Generates HTML for a single IPO group

**Interface**:
```javascript
// Input: Array of applications, Array of IPOs
// Output: Grouped structure
{
  ipoId: {
    ipo: IPO object,
    applications: [Application objects],
    summary: {
      totalApplications: number,
      appliedCount: number,
      allottedCount: number,
      notAllottedCount: number,
      totalInvested: number,
      totalProfit: number
    }
  }
}
```

### 2. Application Modal Manager

**Responsibility**: Handle form initialization with prefilled values based on context

**Key Functions**:
- `openApplicationModal(prefilledIPOId = null)`: Opens modal with optional IPO prefill
- `prefillInvestorField()`: Sets default investor selection
- `handleInvestorChange()`: Updates bank dropdown when investor changes
- `handleIPOChange()`: Updates amount when IPO changes

**Interface**:
```javascript
// Modal state
{
  mode: 'add' | 'edit',
  prefilledIPOId: number | null,
  selectedInvestorId: number | null,
  selectedIPOId: number | null
}
```

### 3. Summary Calculator

**Responsibility**: Compute aggregate statistics for IPO groups

**Key Functions**:
- `calculateIPOSummary(applications)`: Returns summary object with counts and totals

**Interface**:
```javascript
// Input: Array of applications for a specific IPO
// Output: Summary object
{
  totalApplications: number,
  appliedCount: number,
  allottedCount: number,
  notAllottedCount: number,
  totalInvested: number,
  totalProfit: number
}
```

## Data Models

### Existing Models (No Changes)

**Application**:
```javascript
{
  id: number,
  investor_id: number,
  ipo_id: number,
  application_amount: number,
  status: 'Applied' | 'Allotted' | 'Not Allotted',
  payment_status: 'Pending' | 'Received',
  bank_name: string,
  sell_price: number | null,
  profit: number
}
```

**IPO**:
```javascript
{
  id: number,
  ipo_name: string,
  ipo_type: 'Mainboard' | 'SME',
  status: 'Open' | 'Closed',
  ipo_date: string,
  listing_date: string,
  num_shares: number,
  purchase_price_per_share: number,
  sale_price_per_share: number | null,
  profit: number
}
```

**Investor**:
```javascript
{
  id: number,
  name: string,
  upi: string,
  family_group: string,
  banks: string  // comma-separated
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After reviewing the prework analysis, I've identified the following redundancies and consolidations:

- Properties 1.1 and 1.2 can be combined - both relate to the structure of IPO groups
- Properties 4.1 and 4.2 are related but distinct - 4.1 is total count, 4.2 is breakdown by status
- Property 1.3 is comprehensive and doesn't overlap with others
- Properties 2.3 and 2.4 are distinct calculation/update behaviors

All other properties provide unique validation value and should be retained.

### Correctness Properties

Property 1: IPO grouping structure
*For any* set of applications and IPOs, the grouped view should contain exactly one group per IPO that has at least one application, with each group displaying the IPO name as a header
**Validates: Requirements 1.1, 1.2, 1.4**

Property 2: Application display completeness
*For any* application displayed in a group, the rendered output should contain the investor name, application amount, bank name, status, payment status, and profit fields
**Validates: Requirements 1.3**

Property 3: Consistent grouping order
*For any* set of applications and IPOs, running the grouping function multiple times with the same input should produce groups in the same order
**Validates: Requirements 1.5**

Property 4: Investor field prefilling
*For any* modal opening event, the investor dropdown should have a valid investor ID selected by default
**Validates: Requirements 2.1**

Property 5: Bank dropdown synchronization
*For any* investor with a comma-separated banks string, selecting that investor should populate the bank dropdown with exactly those banks
**Validates: Requirements 2.3**

Property 6: Application amount calculation
*For any* IPO with num_shares and purchase_price_per_share values, the auto-calculated application amount should equal num_shares × purchase_price_per_share
**Validates: Requirements 2.4**

Property 7: Form validation completeness
*For any* form submission attempt, the validation should reject forms missing required fields (investor_id, ipo_id, application_amount, bank_name) and accept forms with all required fields populated
**Validates: Requirements 2.5**

Property 8: Add button presence
*For any* IPO group rendered in the view, the group's HTML should contain an "Add Application" button
**Validates: Requirements 3.1**

Property 9: IPO prefilling from context
*For any* "Add Application" button click within an IPO group, the modal should open with the IPO field set to that group's IPO ID
**Validates: Requirements 3.2**

Property 10: Total application count
*For any* set of applications for an IPO, the summary's totalApplications should equal the length of the applications array
**Validates: Requirements 4.1**

Property 11: Status count accuracy
*For any* set of applications for an IPO, the sum of appliedCount, allottedCount, and notAllottedCount should equal totalApplications, and each count should match the number of applications with that status
**Validates: Requirements 4.2**

Property 12: Total invested calculation
*For any* set of applications for an IPO, the summary's totalInvested should equal the sum of all application_amount values
**Validates: Requirements 4.3**

Property 13: Total profit calculation
*For any* set of applications for an IPO, the summary's totalProfit should equal the sum of profit values for applications where status equals 'Allotted'
**Validates: Requirements 4.4**

## Error Handling

### Data Validation Errors

**Scenario**: Missing or invalid data when grouping applications
- **Handling**: Filter out applications with missing ipo_id or investor_id
- **User Feedback**: Log warning to console, continue rendering valid applications

**Scenario**: IPO or Investor not found when rendering
- **Handling**: Display "Unknown" as placeholder text
- **User Feedback**: Show application with limited information

### Form Submission Errors

**Scenario**: Required field validation fails
- **Handling**: Prevent form submission, highlight invalid fields
- **User Feedback**: Display inline error messages for each invalid field

**Scenario**: API request fails during submission
- **Handling**: Catch error, rollback UI state
- **User Feedback**: Display alert with error message

### Edge Cases

**Scenario**: No applications exist in the system
- **Handling**: Display empty state message
- **User Feedback**: "No applications found. Click 'Add Application' to get started."

**Scenario**: No investors exist when opening modal
- **Handling**: Disable form submission, show warning
- **User Feedback**: "Please add investors before creating applications."

**Scenario**: Investor has no banks configured
- **Handling**: Show empty bank dropdown with manual entry option
- **User Feedback**: Allow user to type bank name manually

## Testing Strategy

### Unit Testing

Unit tests will verify individual functions work correctly with specific inputs:

1. **Grouping Function Tests**
   - Test with empty applications array returns empty object
   - Test with single application creates one group
   - Test with multiple applications for same IPO groups correctly
   - Test with applications for different IPOs creates separate groups

2. **Summary Calculation Tests**
   - Test with empty applications returns zero values
   - Test with single application returns correct counts
   - Test with mixed statuses calculates counts correctly
   - Test profit calculation only includes allotted applications

3. **Form Validation Tests**
   - Test with all required fields passes validation
   - Test with missing investor_id fails validation
   - Test with missing ipo_id fails validation
   - Test with missing application_amount fails validation

### Property-Based Testing

Property-based tests will verify universal properties hold across randomly generated inputs using **fast-check** (JavaScript property testing library):

1. **Property Test: IPO Grouping Structure** (Property 1)
   - Generate random arrays of applications and IPOs
   - Verify each IPO with applications appears exactly once
   - Verify IPOs without applications don't appear
   - Verify each group has IPO name header

2. **Property Test: Application Display Completeness** (Property 2)
   - Generate random applications
   - Verify rendered HTML contains all required fields
   - Verify no required fields are missing

3. **Property Test: Bank Dropdown Synchronization** (Property 5)
   - Generate random investors with various bank strings
   - Verify dropdown contains exactly the banks from the string
   - Verify order is preserved

4. **Property Test: Amount Calculation** (Property 6)
   - Generate random IPOs with various share counts and prices
   - Verify calculated amount equals num_shares × purchase_price_per_share
   - Verify calculation handles decimal values correctly

5. **Property Test: Summary Calculations** (Properties 10-13)
   - Generate random arrays of applications with various statuses
   - Verify total count equals array length
   - Verify status counts sum to total
   - Verify invested sum equals sum of amounts
   - Verify profit sum equals sum of allotted profits

Each property-based test will run a minimum of 100 iterations to ensure robustness across diverse inputs.

## Implementation Notes

### Grouping Algorithm

The grouping function will use a Map to efficiently group applications by IPO ID:

```javascript
function groupApplicationsByIPO(applications, ipos) {
  const groups = new Map();
  
  // Create IPO lookup for quick access
  const ipoMap = new Map(ipos.map(ipo => [ipo.id, ipo]));
  
  // Group applications by IPO
  applications.forEach(app => {
    if (!app.ipo_id) return; // Skip invalid applications
    
    if (!groups.has(app.ipo_id)) {
      groups.set(app.ipo_id, {
        ipo: ipoMap.get(app.ipo_id),
        applications: []
      });
    }
    
    groups.get(app.ipo_id).applications.push(app);
  });
  
  return groups;
}
```

### Rendering Strategy

The view will be rendered in a single pass to minimize DOM operations:

1. Fetch all data (applications, IPOs, investors) in parallel
2. Group applications by IPO
3. Calculate summaries for each group
4. Generate HTML for all groups
5. Insert into DOM once

### Form Prefilling Logic

The modal will accept an optional context object to determine prefilling:

```javascript
function openApplicationModal(context = {}) {
  const { prefilledIPOId = null } = context;
  
  // Reset form
  document.getElementById('application-form').reset();
  
  // Prefill IPO if provided
  if (prefilledIPOId) {
    document.getElementById('app-ipo').value = prefilledIPOId;
    // Trigger change event to auto-calculate amount
    document.getElementById('app-ipo').dispatchEvent(new Event('change'));
  }
  
  // Prefill investor with first available
  if (investors.length > 0) {
    document.getElementById('app-investor').value = investors[0].id;
    // Trigger change event to populate banks
    document.getElementById('app-investor').dispatchEvent(new Event('change'));
  }
  
  // Show modal
  document.getElementById('application-modal').classList.remove('hidden');
}
```

## Performance Considerations

### Data Volume

- Expected maximum: ~1000 applications across ~50 IPOs
- Grouping operation: O(n) where n = number of applications
- Rendering: O(n) for generating HTML
- Total time: < 100ms for typical dataset

### Optimization Strategies

1. **Memoization**: Cache grouped data until applications change
2. **Lazy Rendering**: Only render visible groups if list becomes very long
3. **Debouncing**: Debounce search/filter operations if added later

### Browser Compatibility

- Target: Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features used: Map, arrow functions, template literals
- No polyfills required for target browsers

## Future Enhancements

1. **Collapsible Groups**: Allow users to collapse/expand IPO groups
2. **Sorting Options**: Sort groups by date, profit, or application count
3. **Filtering**: Filter applications by status, investor, or date range
4. **Export**: Export IPO-wise application data to Excel
5. **Inline Editing**: Edit application details without opening modal
6. **Drag and Drop**: Reorder applications or move between IPOs
