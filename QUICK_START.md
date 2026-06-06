# 🚀 Quick Start Guide - IPO Dashboard

## Start the Application

### 1. Start Backend
```bash
python app.py
```
Backend runs on: `http://127.0.0.1:5001`

### 2. Open Frontend
Open `index.html` in your browser

---

## Using the New Applications Tab

### View Applications
1. Click **Applications** in sidebar
2. See all IPOs with complete investor lists

### Apply for an IPO
1. Find the IPO you want
2. Locate the investor in the list
3. Click the **"Apply"** button next to their name
4. Confirm the dialog
5. Done! Application created instantly

### Edit an Application
1. Find the applied investor
2. Click the **Edit** icon (pencil)
3. Modify details
4. Save

### Delete an Application
1. Find the applied investor
2. Click the **Delete** icon (trash)
3. Confirm deletion

---

## Visual Guide

### Not Applied (Gray, Faded)
```
Investor Name (Family)  |  ₹15,000  |  UPI123  |  [Apply Button]  |  -  |  -  |  Not applied
```

### Applied (Yellow Border)
```
Investor Name (Family)  |  ₹15,000  |  UPI123  |  ⏳ Applied  |  ⏱️ Pending  |  -  |  [Edit] [Delete]
```

### Allotted (Green Border)
```
Investor Name (Family)  |  ₹15,000  |  UPI123  |  ✅ Allotted  |  💰 Received  |  📈 ₹2,500  |  [Edit] [Delete]
```

### Not Allotted (Red Border)
```
Investor Name (Family)  |  ₹15,000  |  UPI123  |  ❌ Not Allotted  |  -  |  -  |  [Edit] [Delete]
```

---

## Tips

💡 **Bulk Apply**: Scroll through the list and click "Apply" for multiple investors quickly

💡 **Hover Effect**: Not-applied rows brighten when you hover over them

💡 **Auto-Calculate**: Application amount is automatically calculated from IPO details

💡 **Auto-Fill**: UPI ID is automatically filled from investor profile

💡 **Quick Overview**: See at a glance who has and hasn't applied for each IPO

---

## Troubleshooting

**Issue**: "Apply" button doesn't work
- **Solution**: Check that backend is running on port 5001

**Issue**: No investors showing
- **Solution**: Add investors first in the Investors tab

**Issue**: No IPOs showing
- **Solution**: Add IPOs first in the IPOs tab

**Issue**: Amount shows ₹0
- **Solution**: Ensure IPO has num_shares and purchase_price_per_share set

---

## That's It!

You're ready to efficiently manage IPO applications! 🎉

No more repetitive form filling - just click "Apply" and you're done!
