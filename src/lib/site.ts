/** Facts used by the Privacy Policy and Terms pages. */

export const SITE_NAME = "SwipeMail";

/** When the legal pages were last changed. Update it whenever their wording changes. */
export const LEGAL_UPDATED = "November 8, 2026";

/**
 * The email address shown as the contact on the legal pages. It is read from the CONTACT_EMAIL environment variable
 * when the site is built, so it never has to be written into the code. Set it in Vercel (and in .env.local) and redeploy.
 */
export const CONTACT_EMAIL = (process.env.CONTACT_EMAIL ?? "").trim();
