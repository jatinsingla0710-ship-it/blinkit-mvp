const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertLoginEmail(email: string): string {
  const normalized = normalizeLoginEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error('Enter a valid company email.');
  }
  return normalized;
}

export function assertSixDigitCode(code: string): string {
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) {
    throw new Error('Enter the 6-digit code from your email.');
  }
  return token;
}

/** Turn GoTrue messages into something a salesman can act on. */
export function emailCodeErrorMessage(raw: string, action: 'send' | 'verify'): string {
  const message = raw.trim();
  const lower = message.toLowerCase();
  if (
    lower.includes('rate') ||
    lower.includes('too many') ||
    lower.includes('only request this after')
  ) {
    return 'Too many codes were requested. Wait a minute, then try again.';
  }
  if (
    lower.includes('signup') ||
    lower.includes('not allowed') ||
    lower.includes('user not found') ||
    lower.includes('signups not allowed')
  ) {
    return 'No account was found for this email. Ask your admin to add your account, or use your password.';
  }
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('otp')) {
    return 'That code is not valid. Request a new code and try again.';
  }
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return action === 'send'
      ? 'Could not send the code. Check your signal and try again.'
      : 'Could not verify the code. Check your signal and try again.';
  }
  if (message) return message;
  return action === 'send'
    ? 'Could not send the code. Try again.'
    : 'Could not verify the code. Try again.';
}
