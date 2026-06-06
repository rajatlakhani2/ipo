# 👁️ Visual Guide - What You Should See

## 🖥️ Applications Tab - Expected View

### Overall Layout
```
┌────────────────────────────────────────────────────────────────┐
│  Application Tracking - IPO Wise                               │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  📊 Reliance Power IPO                                         │
│  👥 10 Investors | ✅ 5 Applied | ⏳ 3 Pending | 🏆 2 Allotted │
│  Total Invested: ₹75,000 | Profit: ₹5,000                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Investor    │ Amount  │ UPI    │ Status/Action │ Payment││ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ John Doe    │ ₹15,000 │ UPI123 │ [Apply Button]│   -    ││ │ ← Not Applied (Gray, Faded)
│  │ (Family)    │         │        │               │        ││ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Jane Smith  │ ₹15,000 │ UPI456 │ ⏳ Applied    │ ⏱️ Pend││ │ ← Applied (Yellow Border)
│  │ (Friends)   │         │        │ [Edit][Delete]│        ││ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Bob Johnson │ ₹15,000 │ UPI789 │ ✅ Allotted   │ 💰 Rec ││ │ ← Allotted (Green Border)
│  │ (Self)      │         │        │ [Edit][Delete]│ ₹2,500 ││ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  📊 Tata Motors IPO                                            │
│  👥 10 Investors | ✅ 3 Applied | ⏳ 2 Pending | 🏆 1 Allotted │
│  ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual Indicators

### 1. Not Applied Row (Gray, Faded)
```
┌─────────────────────────────────────────────────────────┐
│ ║ John Doe (Family) │ ₹15,000 │ UPI123 │ [Apply] │ - │ - │ Not applied
│ ║ (Gray border, 60% opacity, brightens on hover)
└─────────────────────────────────────────────────────────┘
```

**Characteristics:**
- 🔲 Gray left border (3px solid #ccc)
- 🌫️ Faded appearance (opacity: 0.6)
- ✨ Brightens on hover (opacity: 1.0)
- 🔘 Blue "Apply" button in Status column
- ➖ Dashes in Payment and Profit columns
- 📝 "Not applied" text in Actions column

---

### 2. Applied Row (Yellow/Orange Border)
```
┌─────────────────────────────────────────────────────────┐
│ ║ Jane Smith (Friends) │ ₹15,000 │ UPI456 │ ⏳ Applied │ ⏱️ Pending │ - │ [Edit][Delete]
│ ║ (Yellow/Orange border, full opacity)
└─────────────────────────────────────────────────────────┘
```

**Characteristics:**
- 🟨 Yellow/Orange left border (3px solid var(--warning-color))
- 💯 Full opacity (1.0)
- ⏳ "Applied" status badge with hourglass icon
- ⏱️ "Pending" payment status with clock icon
- ➖ No profit yet (dash)
- ✏️🗑️ Edit and Delete buttons

---

### 3. Allotted Row (Green Border)
```
┌─────────────────────────────────────────────────────────┐
│ ║ Bob Johnson (Self) │ ₹15,000 │ UPI789 │ ✅ Allotted │ 💰 Received │ 📈 ₹2,500 │ [Edit][Delete]
│ ║ (Green border, full opacity)
└─────────────────────────────────────────────────────────┘
```

**Characteristics:**
- 🟩 Green left border (3px solid var(--success-color))
- 💯 Full opacity (1.0)
- ✅ "Allotted" status badge with checkmark icon
- 💰 "Received" payment status with money icon
- 📈 Profit shown in green with up arrow
- ✏️🗑️ Edit and Delete buttons

---

### 4. Not Allotted Row (Red Border)
```
┌─────────────────────────────────────────────────────────┐
│ ║ Alice Brown (Relatives) │ ₹15,000 │ UPI999 │ ❌ Not Allotted │ - │ - │ [Edit][Delete]
│ ║ (Red border, full opacity)
└─────────────────────────────────────────────────────────┘
```

**Characteristics:**
- 🟥 Red left border (3px solid var(--danger-color))
- 💯 Full opacity (1.0)
- ❌ "Not Allotted" status badge with X icon
- ➖ No payment (dash)
- ➖ No profit (dash)
- ✏️🗑️ Edit and Delete buttons

---

## 🖱️ Interactive Elements

### Apply Button
```
┌──────────────┐
│ ✓ Apply      │  ← Blue button, white text
└──────────────┘
```
- **Color**: Blue (btn btn-primary)
- **Icon**: Checkmark (✓)
- **Text**: "Apply"
- **Action**: Click → Confirmation → Creates application

### Hover Effect (Not Applied Rows)
```
Before Hover: opacity: 0.6 (faded)
On Hover:     opacity: 1.0 (bright)
After Hover:  opacity: 0.6 (faded again)
```

### Status Badges
```
⏳ Applied       (Yellow badge)
✅ Allotted      (Green badge)
❌ Not Allotted  (Red badge)
```

### Payment Badges
```
⏱️ Pending      (Gray badge)
💰 Received     (Green badge)
```

### Profit Indicators
```
📈 ₹2,500   (Green text - profit)
📉 -₹500    (Red text - loss)
➖ -        (Gray - no profit/loss)
```

---

## 🎬 User Interaction Flow

### Scenario: Applying for an IPO

**Step 1: Initial View**
```
John Doe (Family) │ ₹15,000 │ UPI123 │ [Apply] │ - │ - │ Not applied
(Gray border, faded)
```

**Step 2: Hover Over Row**
```
John Doe (Family) │ ₹15,000 │ UPI123 │ [Apply] │ - │ - │ Not applied
(Gray border, BRIGHT - opacity 1.0)
```

**Step 3: Click Apply Button**
```
┌─────────────────────────────┐
│  Apply for this IPO?        │
│                             │
│  [Cancel]  [OK]             │
└─────────────────────────────┘
```

**Step 4: After Confirmation**
```
Loading... (page refreshes)
```

**Step 5: Updated View**
```
John Doe (Family) │ ₹15,000 │ UPI123 │ ⏳ Applied │ ⏱️ Pending │ - │ [Edit][Delete]
(Yellow border, full opacity)
```

---

## 📱 Responsive Behavior

### Desktop View
- Full table with all columns visible
- Hover effects work smoothly
- Buttons clearly visible

### Tablet View
- Table may scroll horizontally
- All functionality intact
- Touch-friendly button sizes

### Mobile View
- Table scrolls horizontally
- Pinch to zoom supported
- Tap instead of hover

---

## 🎨 Color Scheme

### Status Colors
- 🟩 **Success/Allotted**: Green (#10b981 or similar)
- 🟨 **Warning/Applied**: Yellow/Orange (#f59e0b or similar)
- 🟥 **Danger/Not Allotted**: Red (#ef4444 or similar)
- 🔲 **Neutral/Not Applied**: Gray (#ccc or similar)

### Text Colors
- **Headings**: Dark gray/black
- **Body Text**: Medium gray
- **Profit**: Green
- **Loss**: Red
- **Neutral**: Gray

### Background Colors
- **Cards**: White
- **Page**: Light gray (#f5f5f5)
- **Hover**: Slightly darker

---

## ✅ Verification Checklist

When you open the Applications tab, verify:

- [ ] IPOs are displayed in separate cards
- [ ] Each IPO shows ALL investors (not just applied ones)
- [ ] Not-applied investors have:
  - [ ] Gray left border
  - [ ] Faded appearance
  - [ ] "Apply" button
  - [ ] Dashes in Payment/Profit columns
- [ ] Applied investors have:
  - [ ] Colored left border (yellow/green/red)
  - [ ] Full opacity
  - [ ] Status badge with icon
  - [ ] Payment status
  - [ ] Edit and Delete buttons
- [ ] Hover effect works on not-applied rows
- [ ] Clicking "Apply" shows confirmation dialog
- [ ] After applying, page refreshes and status updates

---

## 🐛 What If It Doesn't Look Right?

### Issue: All rows look the same
**Cause**: CSS not loading  
**Check**: Are styles defined in style.css?

### Issue: No "Apply" buttons visible
**Cause**: All investors already applied  
**Solution**: Add more investors or delete some applications

### Issue: Borders not showing
**Cause**: CSS border styles not applied  
**Check**: Browser console for CSS errors

### Issue: Icons not showing (✅⏳❌)
**Cause**: Font Awesome not loaded  
**Check**: Is Font Awesome CDN link in index.html?

---

**This is what you should see!** 👀

If your view matches this guide, everything is working perfectly! 🎉
