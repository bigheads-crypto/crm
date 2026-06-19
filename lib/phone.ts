/** Normalizuje numer telefonu — zostawia tylko cyfry i ewentualny prefix '+'. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}
