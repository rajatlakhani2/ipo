# Implementation Plan

- [x] 1. Implement data grouping and summary calculation functions




  - Create `groupApplicationsByIPO()` function to organize applications by IPO
  - Create `calculateIPOSummary()` function to compute statistics for each IPO group
  - Handle edge cases (missing IPO IDs, empty arrays)
  - _Requirements: 1.1, 1.4, 4.1, 4.2, 4.3, 4.4_

- [x] 1.1 Write property test for IPO grouping structure



  - **Property 1: IPO grouping structure**
  - **Validates: Requirements 1.1, 1.2, 1.4**




- [x] 1.2 Write property tests for summary calculations

  - **Property 10: Total application count**
  - **Property 11: Status count accuracy**

  - **Property 12: Total invested calculation**
  - **Property 13: Total profit calculation**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 2. Refactor loadApplicationsView() to use grouped display


  - Modify `loadApplicationsView()` to fetch data and call grouping functions


  - Replace flat table rendering with IPO-grouped rendering
  - Ensure IPO groups are displayed in consistent order
  - _Requirements: 1.1, 1.5_

- [x] 2.1 Write property test for consistent grouping order

  - **Property 3: Consistent grouping order**
  - **Validates: Requirements 1.5**



- [x] 3. Implement IPO group rendering with summary statistics




  - Create `renderIPOGroup()` function to generate HTML for each IPO group
  - Display IPO name as section header
  - Display summary statistics (total applications, status counts, total invested, total profit)
  - Display "Add Application" button within each group
  - _Requirements: 1.2, 3.1, 4.1, 4.2, 4.3, 4.4_

- [x] 3.1 Write property test for add button presence


  - **Property 8: Add button presence**
  - **Validates: Requirements 3.1**



- [x] 4. Implement application list rendering within groups

  - Create function to render individual applications within a group
  - Display all required fields: investor name, amount, bank, status, payment status, profit
  - Include edit and delete action buttons for each application
  - _Requirements: 1.3_


- [x] 4.1 Write property test for application display completeness

  - **Property 2: Application display completeness**

  - **Validates: Requirements 1.3**

- [x] 5. Update openApplicationModal() to support context-based prefilling


  - Modify `openApplicationModal()` to accept optional `prefilledIPOId` parameter
  - Implement IPO field prefilling when parameter is provided
  - Implement investor field prefilling with first available investor
  - Ensure prefilled fields remain editable
  - _Requirements: 2.1, 3.2_

- [x] 5.1 Write property test for investor field prefilling

  - **Property 4: Investor field prefilling**
  - **Validates: Requirements 2.1**

- [x] 5.2 Write property test for IPO prefilling from context

  - **Property 9: IPO prefilling from context**


  - **Validates: Requirements 3.2**


- [x] 6. Update "Add Application" button click handlers

  - Modify global "Add Application" button to call `openApplicationModal()` without parameters

  - Add click handlers to IPO group "Add Application" buttons to pass IPO ID
  - Ensure modal opens with correct prefilled values based on context
  - _Requirements: 3.1, 3.2_

- [x] 7. Enhance investor selection change handler

  - Update event listener on investor dropdown to populate bank options
  - Parse comma-separated banks string and create dropdown options
  - Handle edge case where investor has no banks configured
  - _Requirements: 2.3_

- [x] 7.1 Write property test for bank dropdown synchronization

  - **Property 5: Bank dropdown synchronization**
  - **Validates: Requirements 2.3**

- [x] 8. Enhance IPO selection change handler

  - Update event listener on IPO dropdown to auto-calculate application amount
  - Calculate amount as num_shares × purchase_price_per_share
  - Update amount input field with calculated value
  - _Requirements: 2.4_

- [x] 8.1 Write property test for application amount calculation


  - **Property 6: Application amount calculation**
  - **Validates: Requirements 2.4**

- [x] 9. Implement form validation




  - Add validation function to check required fields before submission
  - Validate investor_id, ipo_id, application_amount, and bank_name are present
  - Display error messages for missing fields
  - Prevent submission if validation fails
  - _Requirements: 2.5_

- [x] 9.1 Write property test for form validation completeness

  - **Property 7: Form validation completeness**
  - **Validates: Requirements 2.5**

- [x] 9.2 Write unit tests for form validation

  - Test validation with all required fields present
  - Test validation with missing investor_id


  - Test validation with missing ipo_id
  - Test validation with missing application_amount
  - Test validation with missing bank_name
  - _Requirements: 2.5_


- [x] 10. Update edit and delete handlers to work with grouped view


  - Ensure `editApplication()` function works correctly from grouped view
  - Ensure `deleteApplication()` function refreshes grouped view after deletion
  - Test that editing/deleting updates the correct IPO group
  - _Requirements: 1.1_

- [x] 11. Add error handling and edge cases


  - Handle empty applications array (display empty state message)
  - Handle missing IPO or investor data (display "Unknown")
  - Handle API errors gracefully with user-friendly messages
  - Handle investor with no banks (allow manual bank entry)
  - _Requirements: 1.1, 1.3_

- [x] 11.1 Write unit tests for edge cases

  - Test grouping with empty applications array
  - Test rendering with missing IPO data
  - Test rendering with missing investor data
  - Test bank dropdown with investor having no banks
  - _Requirements: 1.1, 1.3_

- [x] 12. Final checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
