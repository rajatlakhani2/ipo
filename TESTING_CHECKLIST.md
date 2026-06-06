# 🧪 Testing Checklist - IPO Dashboard

## Pre-Testing Setup

### 1. Start Backend
```bash
cd "D:\New folder\IPO Dashboard"
python app.py
```
✅ Backend should start on `http://127.0.0.1:5001`

### 2. Open Frontend
- Open `index.html` in your browser
- Or navigate to `http://127.0.0.1:5001` if backend serves static files

---

## Test Scenarios

### ✅ Test 1: View Applications Tab

**Steps:**
1. Click on "Applications" in the sidebar
2. Observe the layout

**Expected Result:**
- Should see "Application Tracking - IPO Wise" header
- Each IPO should be in its own card/section
- Each IPO should show ALL investors (not just those who applied)

**What to Check:**
- [ ] IPOs are displayed
- [ ] Each IPO shows investor list
- [ ] Summary stats shown (Total investors, Applications count, etc.)

---

### ✅ Test 2: Identify Not-Applied Investors

**Steps:**
1. Look at any IPO section
2. Find investors who haven't applied yet

**Expected Result:**
- Not-applied investors should have:
  - Gray left border
  - Slightly faded appearance (60% opacity)
  - "Apply" button in the Status/Action column
  - "-" in Payment and Profit columns
  - "Not applied" text in Actions column

**What to Check:**
- [ ] Not-applied rows are visually distinct
- [ ] "Apply" button is visible
- [ ] Hover makes row brighter

---

### ✅ Test 3: Quick Apply Function

**Steps:**
1. Find a not-applied investor
2. Click the "Apply" button
3. Confirm the dialog

**Expected Result:**
- Confirmation dialog appears: "Apply for this IPO?"
- After confirming:
  - Page refreshes
  - Investor now shows as "Applied" status
  - Row has yellow/orange border
  - Shows payment status as "Pending"
  - Edit and Delete buttons appear

**What to Check:**
- [ ] Confirmation dialog appears
- [ ] Application is created
- [ ] Page refreshes automatically
- [ ] Status changes to "Applied"
- [ ] Visual appearance changes (border color, opacity)

---

### ✅ Test 4: Applied Investor Display

**Steps:**
1. Look at investors who have already applied

**Expected Result:**
- Applied investors should show:
  - Colored left border (yellow for Applied, green for Allotted, red for Not Allotted)
  - Full opacity
  - Status badge with icon (⏳ Applied, ✅ Allotted, ❌ Not Allotted)
  - Payment status (💰 Received or ⏱️ Pending)
  - Profit amount (if allotted)
  - Edit and Delete buttons

**What to Check:**
- [ ] Status badges display correctly
- [ ] Icons show properly
- [ ] Border colors match status
- [ ] Edit/Delete buttons work

---

### ✅ Test 5: Multiple IPOs

**Steps:**
1. Scroll through all IPOs
2. Check each IPO section

**Expected Result:**
- Each IPO should show complete investor list
- Mix of applied and not-applied investors
- Summary stats accurate for each IPO

**What to Check:**
- [ ] All IPOs displayed
- [ ] Each IPO has complete investor list
- [ ] Summary stats are correct
- [ ] No duplicate investors

---

### ✅ Test 6: Edit Existing Application

**Steps:**
1. Find an applied investor
2. Click Edit button (pencil icon)
3. Modify status or other fields
4. Save

**Expected Result:**
- Modal opens with pre-filled data
- Can modify fields
- Saves successfully
- View refreshes with updated data

**What to Check:**
- [ ] Edit modal opens
- [ ] Data is pre-filled
- [ ] Can save changes
- [ ] Changes reflect in view

---

### ✅ Test 7: Delete Application

**Steps:**
1. Find an applied investor
2. Click Delete button (trash icon)
3. Confirm deletion

**Expected Result:**
- Confirmation dialog appears
- After confirming:
  - Application is deleted
  - Investor returns to "Not Applied" state
  - "Apply" button reappears

**What to Check:**
- [ ] Confirmation dialog appears
- [ ] Application is deleted
- [ ] Investor shows as not-applied again
- [ ] "Apply" button is back

---

## Common Issues & Solutions

### Issue: Applications tab is blank
**Check:**
- Is backend running?
- Open browser console (F12) - any errors?
- Check network tab - are API calls succeeding?

**Solution:**
- Restart backend
- Check `API_BASE` URL in script.js (should be `http://127.0.0.1:5001/api`)

---

### Issue: No investors showing
**Check:**
- Do you have investors in the database?

**Solution:**
- Go to Investors tab
- Add some investors first
- Return to Applications tab

---

### Issue: No IPOs showing
**Check:**
- Do you have IPOs in the database?

**Solution:**
- Go to IPOs tab
- Add some IPOs first
- Return to Applications tab

---

### Issue: "Apply" button doesn't work
**Check:**
- Browser console for errors
- Network tab for failed API calls

**Solution:**
- Check backend is running
- Verify API endpoint `/api/applications` is working
- Check CORS is enabled

---

### Issue: Amount shows ₹0
**Check:**
- Does the IPO have `num_shares` and `purchase_price_per_share` set?

**Solution:**
- Edit the IPO
- Set num_shares (e.g., 100)
- Set purchase_price_per_share (e.g., 150)
- Amount will auto-calculate (100 × 150 = ₹15,000)

---

### Issue: UPI ID not showing
**Check:**
- Does the investor have a UPI ID set?

**Solution:**
- Edit the investor
- Add UPI ID
- Return to Applications tab

---

## Browser Console Commands

Open browser console (F12) and try these:

```javascript
// Check if data is loaded
console.log('Investors:', investors);
console.log('IPOs:', ipos);
console.log('Applications:', applications);

// Check API connection
fetch('http://127.0.0.1:5001/api/investors')
  .then(r => r.json())
  .then(d => console.log('API Response:', d));
```

---

## Report Issues

If you encounter any issues, please provide:

1. **What you did** (steps to reproduce)
2. **What you expected** (expected result)
3. **What happened** (actual result)
4. **Browser console errors** (F12 → Console tab)
5. **Network errors** (F12 → Network tab)

---

## Success Criteria

✅ All IPOs display with complete investor lists  
✅ Not-applied investors show "Apply" button  
✅ Clicking "Apply" creates application instantly  
✅ Applied investors show full details  
✅ Edit and Delete work correctly  
✅ Visual indicators are clear and distinct  

---

**Happy Testing!** 🧪
