import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  parsePhoneNumber,
  isValidPhoneNumber,
  PhoneNumber,
  ParseError,
} from 'libphonenumber-js';

/**
 * Two-step phone validation:
 * 1. Syntax check  — can it be parsed at all as an E.164 number?
 * 2. Regional rule — is the parsed number valid for its country?
 *
 * Produces specific, user-readable error messages for each failure mode.
 */
@ValidatorConstraint({ name: 'IsValidPhone', async: false })
export class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  private lastError = '';

  validate(phone: unknown, _args: ValidationArguments): boolean {
    if (typeof phone !== 'string' || !phone) {
      this.lastError = 'Phone number is required.';
      return false;
    }

    // Step 1 — Syntax check
    if (!/^\+/.test(phone)) {
      this.lastError =
        'Phone number must start with + followed by the country code (E.164 format, e.g. +447700900000).';
      return false;
    }

    let parsed: PhoneNumber;
    try {
      parsed = parsePhoneNumber(phone);
    } catch (e) {
      if (e instanceof ParseError) {
        this.lastError = buildSyntaxError(e.message, phone);
      } else {
        this.lastError = `Phone number syntax is invalid: "${phone}". Use E.164 format e.g. +447700900000.`;
      }
      return false;
    }

    // Step 2 — Regional rule check
    if (!isValidPhoneNumber(phone)) {
      this.lastError = buildRegionalError(parsed);
      return false;
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return this.lastError || 'Phone number is invalid.';
  }
}

// ── Error builders ────────────────────────────────────────────────────────────

function buildSyntaxError(parseErrorMessage: string, raw: string): string {
  switch (parseErrorMessage) {
    case 'NOT_A_NUMBER':
      return `"${raw}" does not look like a phone number. Use E.164 format e.g. +447700900000.`;
    case 'TOO_SHORT':
      return `Phone number "${raw}" is too short. Check the country code and full number.`;
    case 'TOO_LONG':
      return `Phone number "${raw}" is too long (E.164 max is 15 digits after the +).`;
    case 'INVALID_COUNTRY':
      return `The country code in "${raw}" is not recognised. Use a valid international dialling code.`;
    default:
      return `Phone number syntax error (${parseErrorMessage}): "${raw}". Use E.164 format e.g. +447700900000.`;
  }
}

function buildRegionalError(parsed: PhoneNumber): string {
  const country = parsed.country ?? 'Unknown';
  const nationalNumber = parsed.nationalNumber;
  const intl = parsed.number;

  const countryDescriptions: Record<string, string> = {
    GB: 'UK (+44) national numbers must be exactly 10 digits (e.g. +447700900000 for mobile, +441514960000 for landline).',
    US: 'US/Canada (+1) numbers must be exactly 10 digits after the country code (e.g. +12025550123).',
    AE: 'UAE (+971) mobile numbers are 9 digits starting with 5 (e.g. +971501234567); landlines vary by emirate.',
    SA: 'Saudi Arabia (+966) mobile numbers are 9 digits starting with 5 (e.g. +966512345678).',
    EG: 'Egypt (+20) mobile numbers are 10 digits starting with 1 (e.g. +201012345678).',
    JO: 'Jordan (+962) mobile numbers are 9 digits starting with 7 (e.g. +962791234567).',
    SD: 'Sudan (+249) numbers are typically 9 digits (e.g. +249912345678).',
    SS: 'South Sudan (+211) mobile numbers are 9 digits (e.g. +211912345678).',
    AU: 'Australia (+61) mobile numbers are 9 digits starting with 4 (e.g. +61412345678).',
    CA: 'Canada (+1) numbers must be exactly 10 digits after the country code (e.g. +16135550123).',
    IN: 'India (+91) mobile numbers are 10 digits starting with 6-9 (e.g. +919876543210).',
    PK: 'Pakistan (+92) mobile numbers are 10 digits starting with 3 (e.g. +923001234567).',
    NG: 'Nigeria (+234) mobile numbers are 10 digits starting with 07, 08, or 09 (e.g. +2348012345678).',
  };

  const desc = countryDescriptions[country];
  if (desc) {
    return `Regional rule check failed for ${country}: ${desc} (entered: "${intl}", national part: "${nationalNumber}").`;
  }

  return (
    `Regional rule check failed: "${intl}" is not a valid ${country} phone number. ` +
    `The national number "${nationalNumber}" does not match active numbering plans for this country. ` +
    `Please verify the number is correct and currently in service.`
  );
}

// ── Decorator ─────────────────────────────────────────────────────────────────

export function IsValidPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneConstraint,
    });
  };
}

// ── Service-level helper (used by CustomersService) ───────────────────────────

export interface PhoneValidationResult {
  valid: boolean;
  formatted?: string;    // E.164 formatted number
  country?: string;      // ISO 3166-1 alpha-2 (e.g. "GB")
  type?: string;         // MOBILE, FIXED_LINE, etc.
  rule?: 'syntax_check' | 'regional_rule_check';
  error?: string;        // Human-readable error message
}

export function validatePhoneNumber(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, rule: 'syntax_check', error: 'Phone number is required.' };
  }

  if (!/^\+/.test(phone)) {
    return {
      valid: false,
      rule: 'syntax_check',
      error: 'Phone number must start with + and a country code (E.164 format). Example: +447700900000',
    };
  }

  let parsed: PhoneNumber;
  try {
    parsed = parsePhoneNumber(phone);
  } catch (e) {
    const msg = e instanceof ParseError
      ? buildSyntaxError(e.message, phone)
      : `Phone number syntax is invalid: "${phone}". Use E.164 format.`;
    return { valid: false, rule: 'syntax_check', error: msg };
  }

  if (!isValidPhoneNumber(phone)) {
    return {
      valid: false,
      rule: 'regional_rule_check',
      error: buildRegionalError(parsed),
    };
  }

  return {
    valid: true,
    formatted: parsed.number,
    country: parsed.country,
    type: parsed.getType() ?? undefined,
  };
}
