/**
 * Map Supabase Auth error messages to user-friendly text.
 * Handles rate limits and other common auth errors.
 */
export function getAuthErrorMessage(error: { message?: string } | null): string {
  if (!error?.message) return 'Something went wrong. Please try again.'
  const msg = error.message.toLowerCase()
  if (msg.includes('rate limit') || msg.includes('email rate limit')) {
    return 'Too many sign-in attempts. Please wait a few minutes and try again. (To allow more: Supabase Dashboard → Authentication → Rate limits, or custom SMTP; see README.)'
  }
  if (msg.includes('once every') && msg.includes('second')) {
    return 'Please wait a minute before trying again.'
  }
  return error.message
}
