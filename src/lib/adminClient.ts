const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com", "cyberempire4444@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
