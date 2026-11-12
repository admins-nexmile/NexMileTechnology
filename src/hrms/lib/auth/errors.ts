/**
 * Fixed sign-in error messages. The /login page only ever shows one of
 * these, looked up by code, so no request text is reflected into the page.
 */
export const LOGIN_ERRORS = {
  no_invitation: "No invitation found for this account. Ask HR to invite you.",
  invitation_expired: "Your invitation has expired. Ask HR to send you a new one.",
  unverified: "Your email address could not be verified. Please try again.",
  oauth: "Google sign-in was cancelled or failed. Please try again.",
  callback: "We could not complete sign-in. Please try again.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

export function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return typeof value === "string" && Object.hasOwn(LOGIN_ERRORS, value);
}

export function loginErrorPath(code: LoginErrorCode): string {
  return `/hrms/login?error=${code}`;
}
