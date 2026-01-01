export const normalizePhone = (phone: string): string => {
  if (!phone) return "";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle Ethiopian phone numbers
  if (digits.length === 9 && digits.startsWith("9")) {
    // Format: 912345678 -> +251912345678
    return `+251${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    // Format: 0912345678 -> +251912345678
    return `+251${digits.substring(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("251")) {
    // Format: 251912345678 -> +251912345678
    return `+${digits}`;
  }

  // If already in international format
  if (phone.startsWith("+")) {
    return phone;
  }

  // Default: add + if missing
  return `+${digits}`;
};

export const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return "";

  const normalized = normalizePhone(phone);

  // Format: +251 91 234 5678
  if (normalized.startsWith("+251") && normalized.length === 13) {
    const rest = normalized.substring(4);
    return `+251 ${rest.substring(0, 2)} ${rest.substring(
      2,
      5
    )} ${rest.substring(5)}`;
  }

  return normalized;
};

export const isValidEthiopianPhone = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return /^\+2519\d{8}$/.test(normalized);
};
