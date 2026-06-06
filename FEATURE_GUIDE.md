# IPO Dashboard - Feature Guide

## 🎯 Quick Start

### Applications Tab (IPO-Wise View)

#### Viewing Applications
1. Navigate to **Applications** tab
2. Applications are now organized by IPO
3. Each IPO shows:
   - IPO name, type (Mainboard/SME), and status (Open/Closed)
   - Summary statistics (applications, allotted, invested, profit)
   - Allotment rate percentage
   - List of all applications for that IPO

#### Collapsible Groups
- **Click on IPO header** to expand/collapse individual groups
- **Expand All** button - Opens all IPO groups
- **Collapse All** button - Closes all IPO groups

#### Search & Filter
- **Search Box**: Type investor name to filter applications
- **Status Filter**: Select Applied/Allotted/Not Allotted
- **Sort Options**:
  - By Name (A-Z)
  - By Profit (High to Low / Low to High)
  - By Invested Amount (High to Low)
  - By Number of Applications (Most first)

#### Adding Applications

**Method 1: Global Add**
1. Click **"Add Application"** button at top
2. First investor is auto-selected
3. Their UPI ID is auto-filled
4. Select IPO
5. Amount is auto-calculated
6. Submit

**Method 2: IPO-Specific Add**
1. Click **"Add"** button within an IPO group
2. IPO is pre-selected for that group
3. First investor is auto-selected
4. UPI ID auto-filled
5. Amount auto-calculated
6. Submit

### Dashboard Enhancements

#### IPO Performance Widget
- Shows **Top 5 IPOs** by profit
- Displays for each IPO:
  - Total profit/loss with percentage
  - Number of applications
  - Number allotted
  - Total invested amount
- Color-coded: Green for profit, Red for loss

#### Overall Statistics
- Total Invested across all IPOs
- Total Profit/Loss
- Total Applications count
- Allotted vs Applied vs Not Allotted breakdown
- Bank balance required
- Amount blocked in IPOs

### Visual Indicators

#### Status Icons
- ✅ **Allotted** - Green badge
- ⏳ **Applied** - Yellow badge
- ❌ **Not Allotted** - Red badge

#### Profit Indicators
- 📈 **Profit** - Green text
- 📉 **Loss** - Red text
- ➖ **Neutral** - Gray text

#### Payment Status
- 💰 **Received** - Payment completed
- ⏱️ **Pending** - Payment awaiting

#### Row Highlighting
- **Green left border** - Allotted applications
- **Red left border** - Not allotted applications
- **Yellow left border** - Applied (pending) applications

### Summary Statistics

#### Per IPO Group
- **Total Applications**: Count of all applications
- **Status Breakdown**: Applied/Allotted/Not Allotted counts
- **Allotment Rate**: Percentage of applications allotted
- **Total Invested**: Sum of all application amounts
- **Total Profit/Loss**: With ROI percentage
- **Average per Application**: Mean investment amount

#### Overall Summary Card
Located at top of Applications tab:
- Total IPOs with applications
- Total applications count
- Total invested amount
- Total profit/loss
- Overall allotment rate

### Tips & Tricks

1. **Quick Navigation**: Use search to find specific investors instantly
2. **Bulk View**: Use "Expand All" to see all applications at once
3. **Focus Mode**: Use "Collapse All" then expand only IPOs you're interested in
4. **Performance Check**: Sort by profit to see best/worst performing IPOs
5. **Investment Overview**: Sort by invested amount to see where most capital is deployed
6. **Family Tracking**: Investor's family group shown next to name for easy identification

### Data Entry Best Practices

1. **Add Investors First**: Ensure investors exist with UPI IDs configured
2. **Create IPOs**: Set up IPO details (shares, price) before adding applications
3. **Use IPO-Specific Add**: When adding multiple applications for same IPO, use the "Add" button within that IPO group
4. **Verify UPI**: Check that UPI ID is correctly auto-filled from investor profile
5. **Update Status**: Keep application status updated (Applied → Allotted/Not Allotted)
6. **Track Payments**: Update payment status when money is received

### Keyboard Shortcuts

- **Search**: Click search box or use Tab to navigate
- **Enter**: Submit forms
- **Escape**: Close modals (if implemented)

### Reports Section

The Reports tab shows:
- **Bank-wise Statistics**: Blocked and invested amounts per bank/UPI
- **IPO Profit Summary**: Profit breakdown by IPO with allotment counts

### Troubleshooting

**Issue**: IPO group not showing
- **Solution**: Ensure at least one application exists for that IPO

**Issue**: UPI not auto-filling
- **Solution**: Check that investor has UPI ID configured in Investor Management

**Issue**: Amount not auto-calculating
- **Solution**: Verify IPO has num_shares and purchase_price_per_share set

**Issue**: Search not working
- **Solution**: Refresh the page and try again

**Issue**: Sort not applying
- **Solution**: Select sort option from dropdown again

### Future Enhancements (Potential)

- Export to Excel functionality
- Bulk status updates
- Email notifications for allotments
- Mobile responsive design improvements
- Dark mode enhancements
- Advanced filtering (by date, amount range)
- Charts and graphs for visual analytics
- Comparison between IPOs
- Historical performance tracking

---

## 🎨 Color Scheme Reference

- **Success/Profit**: Green (#10b981 or similar)
- **Danger/Loss**: Red (#ef4444 or similar)
- **Warning/Pending**: Yellow/Orange
- **Primary**: Blue gradient
- **Secondary**: Purple gradient

## 📱 Browser Compatibility

Tested and working on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🔧 Technical Notes

- All data is fetched from Flask API endpoints
- Real-time calculations performed client-side
- No page refresh needed for most operations
- Responsive grid layouts adapt to screen size
- Smooth CSS transitions for better UX

---

**Version**: 2.0  
**Last Updated**: December 2024  
**Status**: Production Ready ✅
