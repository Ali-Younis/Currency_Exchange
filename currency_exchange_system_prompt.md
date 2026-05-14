# System Specification and Agent Prompt: Modern Currency Exchange Management System

## 1. Project Overview & Context
**Objective:** Re-platform a currency exchange agency's operational system from a legacy Arabic Excel-based solution to a modern, containerized, high-performance web application. 
**Business Context:** The agency is based in London, UK. The base currency for all accounting and profit calculations is the **British Pound (GBP)**. 
**Target Audience:** Tell clerks (Users) processing daily physical/digital currency exchanges, and Branch Managers/Owners (Admins) managing balances and auditing.

## 2. Multi-Agent Orchestration Instructions for Claude
*Claude, please act as an AI Engineering Manager. To build this system efficiently, simulate the following specialized sub-agents and execute their tasks sequentially. When you reply, provide the output for each agent's domain.*

* **[Agent 1] System Architect:** Define the modular architecture, tech stack, and API contracts.
* **[Agent 2] Database Engineer:** Design the ACID-compliant PostgreSQL schema.
* **[Agent 3] UI/UX Designer (Frontend):** Build the Next.js/React frontend with Xe.com-inspired styling and full RTL/LTR internationalization (i18n).
* **[Agent 4] DevOps & SRE:** Create the containerization strategy (Docker/Kubernetes ready) ensuring high availability.
* **[Agent 5] QA & Security:** Define RBAC policies, input validation, and testing frameworks.

---

## 3. Core Requirements & Extracted Legacy Features

Based on the legacy system, the new application MUST support the following modules:

### 3.1. Currency Management & Opening Balances
* **Currencies Supported:** USD, GBP, JOD (Dinar), EUR, SAR (Riyal), AED (Dirham), CHF (Franc), EGP (Egyptian Pound), BHD (Bahraini Riyal), AUD, etc.
* **Opening Balance Module (رصيد بداية المدة):** Form to input the starting physical/digital balance of each currency at the start of a shift/day.

### 3.2. Transaction Processing (Buy & Sell)
* **Buy Operations (عمليات الشراء):** The agency buys foreign currency from a customer in exchange for the base currency (or another currency).
* **Sell Operations (عمليات البيع):** The agency sells foreign currency to a customer.
* **Data Captured per Transaction:** * Serial ID / Receipt Number
    * Timestamp (Date & Time)
    * Customer Name
    * Currency In (Amount & Type)
    * Currency Out (Amount & Type)
    * Exchange Rate applied
    * Total Value (in Base Currency - GBP)

### 3.3. Ledgers & Reporting
* **Daily Ledgers (حركات الشراء / حركات البيع):** Real-time grid showing all daily transactions, summarized by currency type.
* **End-of-Day/Shift Report (تقرير عمليات):** A consolidated view showing: `[Currency] | [Opening Balance] | [Total Buys] | [Total Sells] | [Closing Balance]`.

---

## 4. Technical Architecture & Best Practices

### 4.1. Proposed Technology Stack
* **Frontend:** Next.js (React), Tailwind CSS (for rapid, Xe.com-themed styling), `next-intl` or `i18next` for English/Arabic support.
* **Backend:** Node.js with NestJS OR Python with FastAPI (modular, highly typed, easily testable).
* **Database:** PostgreSQL (Strict ACID compliance is non-negotiable for financial data).
* **Caching/Sessions:** Redis (for fast exchange rate lookups and session management).
* **Containerization:** Docker & Docker Compose.

### 4.2. Internationalization (i18n)
* The system must seamlessly toggle between **English (LTR)** and **Arabic (RTL)**.
* UI layouts must flip conditionally based on the selected locale.
* Numeric formats and dates must localize appropriately.

### 4.3. UI/UX Guidelines (Xe.com Theme)
* **Color Palette:** Trustworthy financial colors. Deep Navy Blue headers (`#0A146E`), clean white backgrounds, subtle gray card borders, and clear green/red indicators for positive/negative balances or buy/sell actions.
* **Layout:** Sidebar navigation for modules (Dashboard, Buy, Sell, Ledgers, Reports, Settings).
* **Typography:** highly legible sans-serif fonts (e.g., Inter or Roboto) with adequate sizing for fast-paced teller environments.
* **UX:** Keyboard-first data entry for tellers to maximize speed.

### 4.4. Security & Role-Based Access Control (RBAC)
* **Admin Role:** Can view all reports, set daily exchange rate limits, configure opening balances, create/delete users, and void transactions.
* **User (Teller) Role:** Can only execute Buy/Sell transactions, view their own daily ledger, and print receipts. Cannot edit historical data.

### 4.5. Reliability & Scalability Requirements
* **Redundancy:** Stateless backend design to allow multiple container replicas.
* **Resilience:** Implement retry mechanisms for database deadlocks and graceful error handling on the frontend.
* **Audit Trail:** Every transaction, login, and configuration change must be logged in an immutable audit table.

---

## 5. Instructions for the First Output
**Claude:** Please begin by acknowledging these requirements. Then, deploy **[Agent 1] System Architect** and **[Agent 2] Database Engineer** to output the proposed backend directory structure and the core PostgreSQL database schema (in SQL or Prisma/TypeORM schema format). 
