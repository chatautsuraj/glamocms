/** Customer details: Nepali mobile numbers and order-taking validation. */

/** Digits of a Nepali mobile without +977 / 977 / 0 prefixes, spaces or dashes. */
export function normalizeNepalMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("977")) digits = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** Nepali mobile: 98 or 97 followed by 8 digits (NTC / Ncell / Smart). */
export function isNepalMobile(raw: string): boolean {
  return /^9[78]\d{8}$/.test(normalizeNepalMobile(raw));
}

export interface OrderCustomerInput {
  name: string;
  phone: string;
  address: string;
}

export type OrderCustomerErrors = Partial<Record<keyof OrderCustomerInput, string>>;

/**
 * Phone / WhatsApp / manual orders must name the customer, reach them and know
 * where to deliver. Returns an empty object when everything is fine.
 */
export function validateOrderCustomer(input: OrderCustomerInput, opts: { requireAddress?: boolean } = {}): OrderCustomerErrors {
  const errors: OrderCustomerErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter the customer's name.";
  else if (name.length < 2) errors.name = "Name is too short.";
  if (!input.phone.trim()) errors.phone = "Enter the customer's mobile number.";
  else if (!isNepalMobile(input.phone)) errors.phone = "Use a 10-digit mobile starting with 98 or 97.";
  if (opts.requireAddress !== false) {
    const address = input.address.trim();
    if (!address) errors.address = "Enter the delivery address.";
    else if (address.length < 4) errors.address = "Add a little more detail (area, street or landmark).";
  }
  return errors;
}

/** Counter sale: the phone is optional, but if typed it must be a valid mobile. */
export function counterPhoneError(raw: string): string | null {
  if (!raw.trim()) return null;
  return isNepalMobile(raw) ? null : "Use a 10-digit mobile starting with 98 or 97.";
}
