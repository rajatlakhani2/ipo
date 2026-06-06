# Requirements Document

## Introduction

This feature reorganizes the Applications tab in the IPO Dashboard to display applications grouped by IPO rather than by individual investor. Additionally, when adding a new application, the investor name field will be automatically prefilled based on context. This improves the user experience by providing a more logical organization of application data and reducing manual data entry.

## Glossary

- **Application**: A record representing an investor's application to purchase shares in a specific IPO
- **IPO**: Initial Public Offering - a company's first sale of stock to the public
- **Investor**: An individual who applies for shares in IPOs
- **Application Tab**: The user interface section that displays all IPO applications
- **System**: The IPO Dashboard web application
- **Grouped View**: A display format where applications are organized under their respective IPO headings
- **Prefilled Field**: A form input that is automatically populated with a value

## Requirements

### Requirement 1

**User Story:** As a user, I want to view applications organized by IPO, so that I can easily see all applications for each IPO together.

#### Acceptance Criteria

1. WHEN a user navigates to the Applications tab THEN the System SHALL display applications grouped by IPO name
2. WHEN displaying grouped applications THEN the System SHALL show the IPO name as a section header for each group
3. WHEN displaying applications within a group THEN the System SHALL show investor name, application amount, bank, status, payment status, and profit for each application
4. WHEN an IPO has no applications THEN the System SHALL not display that IPO in the Applications tab
5. WHEN multiple IPOs have applications THEN the System SHALL display IPO groups in a consistent order

### Requirement 2

**User Story:** As a user, I want the investor name to be automatically filled when adding an application, so that I can save time and reduce data entry errors.

#### Acceptance Criteria

1. WHEN a user opens the Add Application modal THEN the System SHALL prefill the investor name field with a default or contextual value
2. WHEN the investor name field is prefilled THEN the System SHALL allow the user to change the selection
3. WHEN a user selects a different investor THEN the System SHALL update the bank dropdown options to match the selected investor's available banks
4. WHEN a user selects an IPO THEN the System SHALL auto-calculate and populate the application amount based on the IPO's share price and quantity
5. WHEN the application form is submitted THEN the System SHALL validate that all required fields contain valid data

### Requirement 3

**User Story:** As a user, I want to add applications from within an IPO group, so that I can quickly add multiple applications for the same IPO.

#### Acceptance Criteria

1. WHEN viewing applications grouped by IPO THEN the System SHALL display an "Add Application" button within each IPO group
2. WHEN a user clicks the "Add Application" button within an IPO group THEN the System SHALL open the application modal with the IPO field prefilled to that specific IPO
3. WHEN the IPO field is prefilled THEN the System SHALL allow the user to change the IPO selection if needed
4. WHEN the modal is opened from an IPO group THEN the System SHALL maintain all other modal functionality including investor selection and bank dropdown population

### Requirement 4

**User Story:** As a user, I want to see summary information for each IPO group, so that I can quickly understand the overall status of applications for that IPO.

#### Acceptance Criteria

1. WHEN displaying an IPO group THEN the System SHALL show the total number of applications for that IPO
2. WHEN displaying an IPO group THEN the System SHALL show the count of applications by status (Applied, Allotted, Not Allotted)
3. WHEN displaying an IPO group THEN the System SHALL show the total amount invested across all applications for that IPO
4. WHEN displaying an IPO group THEN the System SHALL show the total profit or loss across all allotted applications for that IPO
5. WHEN calculating summary statistics THEN the System SHALL update the values in real-time as applications are added, edited, or deleted
