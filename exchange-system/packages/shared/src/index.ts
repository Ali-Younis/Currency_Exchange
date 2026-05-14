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

/** Returned when the user needs to enrol in TOTP before getting a full token */
export interface TotpEnrollRequired {
  requiresEnrollment: true;
  enrollToken: string;   // short-lived JWT (5 min), used only for /auth/totp/setup & /auth/totp/enroll
}

/** Returned when the user is enrolled but must verify their TOTP code */
export interface TotpVerifyRequired {
  requiresTotp: true;
  preAuthToken: string;  // short-lived JWT (5 min), used only for /auth/totp/verify
}

/** Returned when the user must change their password before continuing */
export interface PasswordChangeRequired {
  requiresPasswordChange: true;
  preAuthToken: string;  // short-lived JWT (5 min), used only for /auth/change-password
}

export type LoginResult = AuthResponse | TotpEnrollRequired | TotpVerifyRequired | PasswordChangeRequired;

export interface AuthResponse {
  accessToken: string;
  user: UserSummary;
}

export interface ChangePasswordDto {
  preAuthToken: string;
  newPassword: string;
}

// ─── Users ───────────────────────────────────

export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  permissions?: string[];
  totpEnabled?: boolean;
  forcePasswordChange?: boolean;
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
  countryCode?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateCurrencyDto {
  code: string;
  nameEn: string;
  nameAr: string;
  symbol: string;
  countryCode?: string;
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
  customerEmail?: string | null;
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
  customerEmail?: string;
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
  symbol: string;
  countryCode?: string | null;
  openingBalance: string;
  totalBuys: string;
  totalSells: string;
  closingBalance: string;
}

export interface SessionReport {
  sessionDate: string;
  rows: SessionReportRow[];
}

// ─── Admin Report DTOs ────────────────────────

export interface ProfitReportRow {
  currencyId: string;
  currencyCode: string;
  currencyNameEn: string;
  symbol: string;
  totalTransactions: number;
  totalVolumeGbp: string;
  totalProfitGbp: string;
  avgProfitPerTxnGbp: string;
}

export interface ProfitReport {
  startDate: string;
  endDate: string;
  grandTotalProfitGbp: string;
  grandTotalVolumeGbp: string;
  rows: ProfitReportRow[];
}

export interface TrendDataPoint {
  date: string;
  count: number;
  volumeGbp: string;
  buys: number;
  sells: number;
}

export interface VolumeReport {
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'week' | 'month';
  totalTransactions: number;
  trendPoints: TrendDataPoint[];
}

export interface TopCustomerDto {
  rank: number;
  customerName: string;
  totalTransactions: number;
  totalVolumeGbp: string;
  totalProfitGbp: string;
}

export interface TopCustomersReport {
  startDate: string;
  endDate: string;
  customers: TopCustomerDto[];
}

export interface RateHistoryEntry {
  id: string;
  effectiveDate: string;
  buyRate: string;
  sellRate: string;
  spread: string;
  setBy: { id: string; fullName: string };
  currencyCode: string;
}

export interface RateHistoryReport {
  currencyId: string;
  startDate: string;
  endDate: string;
  history: RateHistoryEntry[];
}

export interface AuditReportEntry {
  id: string;
  userId?: string;
  user?: { id: string; fullName: string; username: string };
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  payload?: unknown;
  createdAt: string;
}

export interface EndOfDayReport {
  sessionDate: string;
  totalTransactions: number;
  voidedTransactions: number;
  totalVolumeGbp: string;
  totalProfitGbp: string;
  balances: SessionReportRow[];
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

// ─── App Settings ────────────────────────────

export interface AppSettingDto {
  key: string;
  value: string;
}

export interface SetAppSettingDto {
  value: string;
}

// ─── Current Balances ────────────────────────

export interface CurrentBalanceRow {
  currencyId: string;
  currencyCode: string;
  currencyNameEn: string;
  currencyNameAr: string;
  symbol: string;
  countryCode?: string | null;
  openingBalance: string;
  totalBuys: string;
  totalSells: string;
  currentBalance: string;
}
