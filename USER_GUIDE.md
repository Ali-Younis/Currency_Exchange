# Exchange Manager — User Guide

## Getting Started

### First Login

1. Navigate to `http://localhost` in your browser.
2. Enter your username and password (provided by your administrator).
3. **Change Password** — On first login, you will be prompted to set a new password. The password must be at least 12 characters and contain uppercase, lowercase, a digit, and a special character (e.g. `MySecure@2025!`).
4. **Enrol TOTP** — After setting your password, scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code to complete enrolment.
5. You will be taken to the dashboard.

### Subsequent Logins

1. Enter username and password.
2. Enter the 6-digit TOTP code from your authenticator app.
3. You are now logged in.

---

## Roles

| Role | Capabilities |
|---|---|
| **Admin** | Full access to all pages and settings |
| **Teller** | Access to pages permitted by admin (Buy, Sell, Ledger, Reports) |

---

## Navigation

The sidebar provides access to all sections. Your administrator controls which sections are available to you as a teller.

| Section | Description |
|---|---|
| Dashboard | Summary stats — transactions today, total volume, profit |
| Buy | Record a buy transaction (agency buys foreign currency) |
| Sell | Record a sell transaction (agency sells foreign currency) |
| Ledger | View all transactions for the current session |
| Reports | End-of-day and date-range reports |
| Balances | Set opening balances for each currency (admin only) |
| Current Balances | Live running balance per currency (admin only) |
| Rates | Manage exchange rates (admin only) |
| Currencies | Manage supported currencies (admin only) |
| Users | Manage staff accounts (admin only) |
| Settings | System settings — language, logo, SMTP (admin only) |

### Language Switcher

A language toggle (EN / عربية) appears at the bottom of the sidebar for all users. Click it to switch between English and Arabic. The page reloads to apply the change.

---

## Recording Transactions

### Buy Transaction (Agency Buys Foreign Currency)

1. Go to **Buy** in the sidebar.
2. Fill in:
   - **Customer Name** — required
   - **Customer Email** — optional; if provided, an email receipt is sent automatically
   - **Currency In** — the foreign currency the customer is giving you
   - **Amount In** — the amount in that currency
   - **Currency Out** — typically GBP (what you give the customer)
   - **Amount Out** — auto-calculated from the current rate; you can override if needed
   - **Rate Applied** — auto-filled from today's exchange rate; editable
   - **Notes** — optional
3. Click **Confirm**.
4. A receipt banner appears. Click **Receipt (PDF)** to download a PDF receipt.

### Sell Transaction (Agency Sells Foreign Currency)

Same steps as above, but in reverse — the customer gives GBP and receives foreign currency.

---

## Current Balances

**Current Balances** (admin only) shows a live table of all currency balances, calculated as:

```
Current Balance = Opening Balance + Total Buys − Total Sells
```

The page auto-refreshes every 30 seconds. The timestamp of the last refresh is shown at the top right.

---

## Reports

### Session Report

Shows all transactions for the current day. Use the **Export Excel** button to download an XLSX file.

### End-of-Day Report

Provides a summary per currency: opening balance, total bought, total sold, closing balance, and profit in GBP.

---

## Admin Functions

### Managing Users (Admin Only)

1. Go to **Users**.
2. To create a user, click **+ Add User** and fill in the form. New users must change their password on first login.
3. To edit a user, click **Edit** on their row:
   - **Section Access** (tellers only) — check the boxes for pages the teller can access
   - **Force password change** — tick to make the user reset their password on next login
   - **Reset TOTP** — if the user has lost access to their authenticator app, click this to reset their TOTP enrolment. They will re-enrol on next login.
4. To deactivate/activate a user, click **Deactivate** / **Activate** on their row.

### Managing Exchange Rates (Admin Only)

1. Go to **Rates**.
2. For each currency, enter the **Buy Rate** and **Sell Rate** (units of foreign currency per £1 GBP).
3. Click **Save** to apply. Rates take effect immediately on new transactions.

### Setting Opening Balances (Admin Only)

1. Go to **Balances**.
2. Select a session date (defaults to today).
3. Enter the opening cash amount for each currency.
4. Click **Save**.

### Settings (Admin Only)

#### Company Logo

1. Go to **Settings**.
2. Under **Company Logo**, click **Choose File** and select an image.
3. A preview appears. Click **Save Logo** to store it.
4. The logo will appear in the sidebar for all users.

#### SMTP / Email Configuration

Configure SMTP to enable automatic email receipts to customers.

1. Go to **Settings**.
2. Under **SMTP / Email Settings**, enter:
   - **SMTP Host** — your mail server hostname (e.g. `smtp.gmail.com`)
   - **SMTP Port** — typically `587` (STARTTLS) or `465` (SSL)
   - **SMTP Username** — your SMTP account username
   - **SMTP Password** — your SMTP password (leave blank to keep the existing one)
   - **From Address** — the "From" email address (e.g. `receipts@myexchange.co.uk`)
3. Click **Save SMTP**.
4. Use the **Send Test** section to send a test email to verify the configuration.

#### Display Language

Select **English** or **العربية** and the page will reload with the new language applied.

---

## Teller Permissions

Admins control which sections each teller can access:

| Permission | Unlocks |
|---|---|
| `buy` | Buy transaction page |
| `sell` | Sell transaction page |
| `ledger` | Transaction ledger page |
| `reports` | Reports page |

Tellers without a specific permission will not see that page in the sidebar.

---

## Security Notes

- Your password must be at least 12 characters with mixed case, a digit, and a special character.
- Your TOTP code changes every 30 seconds — use it promptly.
- If you lose access to your authenticator app, contact your administrator to reset your TOTP.
- Each session is protected by a signed JWT token that expires after 8 hours.
- Logging out immediately invalidates your session token.
