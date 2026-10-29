/**
 * Phone Number Normalization to E.164 format
 */

export function normalizePhone(rawPhone, defaultCountryCode = '91') {
  if (!rawPhone) return { isValid: false, phone: null, error: 'Phone number is empty' };

  // Remove spaces, dashes, parentheses, non-digit chars except leading plus
  let cleaned = String(rawPhone).trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    if (!cleaned.startsWith(defaultCountryCode)) {
      cleaned = defaultCountryCode + cleaned;
    }
  } else if (cleaned.length === 10) {
    // 10 digits standard mobile number, prepend default country code
    cleaned = defaultCountryCode + cleaned;
  }

  // Remove any remaining non-digits
  cleaned = cleaned.replace(/\D/g, '');

  // E.164 numbers are between 8 and 15 digits
  if (cleaned.length < 8 || cleaned.length > 15) {
    return {
      isValid: false,
      phone: null,
      error: `Invalid phone length (${cleaned.length} digits). E.164 standard requires 8-15 digits.`
    };
  }

  return {
    isValid: true,
    phone: `+${cleaned}`,
    countryCode: defaultCountryCode
  };
}

export default {
  normalizePhone
};
