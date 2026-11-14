import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { getAppConfig } from "./config";

export const SESSION_COOKIE = "mandate_session";
export const OAUTH_STATE_COOKIE = "mandate_oauth_state";
export const OAUTH_RETURN_COOKIE = "mandate_oauth_return";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_TTL_SECONDS = 60 * 10;
const ISSUER = "mandate";
const AUDIENCE = "mandate-web";

export type SessionUser = {
  ownerId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  mode: "github" | "local";
};

export const LOCAL_OWNER_ID = "local";

const localUser = (): SessionUser => ({
  ownerId: LOCAL_OWNER_ID,
  login: "local",
  name: "Local operator",
  avatarUrl: null,
  mode: "local",
});

const secretKey = (secret: string) => new TextEncoder().encode(secret);

export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/app";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  if (/[\\\u0000-\u001f]/.test(value)) return "/app";

  // Reject encoded variants of protocol-relative or backslash paths before
  // handing the value to a redirect response.
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/app";
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\") ||
    /[\\\u0000-\u001f]/.test(decoded)
  ) {
    return "/app";
  }
  return value;
}

export function requestOrigin(request: Request): string {
  const config = getAppConfig();
  if (config.auth.publicUrl) return config.auth.publicUrl;
  return new URL(request.url).origin;
}

export function githubCallbackUrl(origin: string): string {
  return `${origin}/api/auth/github/callback`;
}

export function isSecureOrigin(origin: string): boolean {
  return origin.startsWith("https://");
}

export async function createSessionToken(
  user: SessionUser,
  secret: string,
): Promise<string> {
  return new SignJWT({
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    mode: user.mode,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.ownerId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const config = getAppConfig();
  if (config.auth.error) return null;
  if (config.auth.mode === "local") return localUser();
  if (!config.auth.secret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(config.auth.secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const ownerId = payload.sub;
    if (
      typeof ownerId !== "string" ||
      !ownerId.startsWith("github:") ||
      typeof payload.login !== "string" ||
      payload.login.length === 0
    ) {
      return null;
    }
    return {
      ownerId,
      login: payload.login,
      name: typeof payload.name === "string" ? payload.name : null,
      avatarUrl:
        typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
      mode: "github",
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  return user;
}

export async function setSessionCookie(
  origin: string,
  user: SessionUser,
  secret: string,
): Promise<void> {
  const token = await createSessionToken(user, secret);
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureOrigin(origin),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function setOAuthCookie(
  name: typeof OAUTH_STATE_COOKIE | typeof OAUTH_RETURN_COOKIE,
  value: string,
  origin: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureOrigin(origin),
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  });
}

export async function clearOAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_RETURN_COOKIE]) {
    cookieStore.delete(name);
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
