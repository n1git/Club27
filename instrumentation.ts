export function register() {
  if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) {
    console.warn("[27club] EMAIL_API_KEY or EMAIL_FROM is not set: club registration skips email verification.");
  }
  if (!process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY) {
    console.warn("[27club] TURNSTILE_SITE_KEY or TURNSTILE_SECRET_KEY is not set: club registration skips the captcha.");
  }
}
