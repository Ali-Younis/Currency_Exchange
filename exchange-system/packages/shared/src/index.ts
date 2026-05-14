// ─────────────────────────────────────────────
// Shared enums, types, and DTOs
// Used by both apps/api and apps/web
// ─────────────────────────────────────────────

export type Role = 'ADMIN' | 'TELLER';
export type TransactionType = 'BUY' | 'SELL';

// ─── Auth ────────────────────────────────────

export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthTokenPayload {
  sub: string;      // user UUID
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: UserSummary;
}

// ─── Users ───────────────────────────────────

export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface CreateUserDto {
  username: string;
  password: string;
  fullName: string;
  role: Role;
}

// ─── Currencies ──────────────────────────────

export interface CurrencyDto {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  symbol: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateCurrencyDto {
  code: string;
  nameEn: string;
  nameAr: string;
  symbol: string;
  sortOrder?: number;
}

// ─── Exchange Rates ──────────────────────────

export interface ExchangeRateDto {
  id: string;
  currencyId: string;
  currencyCode: string;
  buyRate: string;   // Decimal as string to avoid float precision
  sellRate: string;
  effectiveDate: string;
  setById: string;
}

export interface SetExchangeRateDto {
  currencyId: string;
  buyRate: string;
  sellRate: string;
}

// ─── Opening Balances ────────────────────────

export interface OpeningBalanceDto {
  id: string;
  currencyId: string;
  currencyCode: string;
  amount: string;
  sessionDate: string; // ISO date string YYYY-MM-DD
}

export interface SetOpeningBalanceDto {
  currencyId: string;
  amount: string;
  sessionDate: string;
}

// ─── Transactions ────────────────────────────

export interface TransactionDto {
  id: string;
  receiptNumber: string;
  type: TransactionType;
  customerName: string;
  currencyInId: string;
  currencyInCode: string;
  amountIn: string;
  currencyOutId: string;
  currencyOutCode: string;
  amountOut: string;
  rateApplied: string;
  valueInGbp: string;
  notes?: string;
  isVoided: boolean;
  tellerId: string;
  tellerName: string;
  createdAt: string;
  sessionDate: string;
}

export interface CreateTransactionDto {
  type: TransactionType;
  customerName: string;
  currencyInId: string;
  amountIn: string;
  currencyOutId: string;
  amountOut: string;
  rateApplied: string;
  notes?: string;
  sessionDate: string;
}

export interface VoidTransactionDto {
  reason: string;
}

// ─── Reports ─────────────────────────────────

export interface SessionReportRow {
  currencyId: string;
  currencyCode: string;
  currencyNameEn: string;
  currencyNameAr: string;
  openingBalance: string;
  totalBuys: string;
  totalSells: string;
  closingBalance: string;
}

export interface SessionReport {
  sessionDate: string;
  rows: SessionReportRow[];
}

// ─── Pagination ──────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface TransactionFilterQuery extends PaginationQuery {
  sessionDate?: string;
  type?: TransactionType;
  tellerId?: string;
}
