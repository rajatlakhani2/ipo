
# Manual Verification Checklist

1.  **Open Dashboard:** Run `start_app.bat` and ensure the dashboard loads.
2.  **Toast Test:**
    *   Find an open IPO.
    *   Click "Apply" for an investor.
    *   Verify a toast message appears (success or error) instead of a browser alert.
3.  **Inline Editing Test:**
    *   Go to "Application Tracking".
    *   Find an application.
    *   Change the "Bank" dropdown. Verify the toast appears and value persists.
    *   Change the "Status" dropdown. Verify stats update and toast appears.
4.  **Bank Fix Test:**
    *   Click "Edit" (pencil icon) on an application.
    *   Verify the "Bank Name" dropdown is populated with the investor's banks.
5.  **Smart Filtering Test:**
    *   Manually set an IPO status to "Closed" (via "Edit IPO").
    *   Reload the page.
    *   Verify that only "Allotted" applications are visible for that IPO.
