import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  clearOAuthCookies,
  googleCallbackUrl,
  requestOrigin,
  safeReturnTo,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { getAppConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

function secretsMatch(expected: string, received: string): boolean {
  if (!expected || !received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function exchangeCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string | null> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as GoogleTokenResponse;
  return payload.id_token ?? null;
}

async function verifyIdentity(
  idToken: string,
  clientId: string,
  nonce: string,
): Promise<SessionUser | null> {
  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email.length === 0 ||
    payload.email_verified !== true ||
    typeof payload.nonce !== "string" ||
    !secretsMatch(nonce, payload.nonce)
  ) {
    return null;
  }
  return {
    ownerId: `google:${payload.sub}`,
    login: payload.email,
    name: typeof payload.name === "string" ? payload.name : payload.email,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
    mode: "google",
  };
}

export async function GET(request: Request) {
  const config = getAppConfig();
  if (config.auth.error) redirect("/signin?error=config");
  if (
    config.auth.mode !== "google" ||
    !config.auth.googleClientId ||
    !config.auth.googleClientSecret ||
    !config.auth.secret
  ) {
    redirect("/signin?error=config");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const expectedNonce = cookieStore.get(OAUTH_NONCE_COOKIE)?.value ?? "";
  const returnTo = safeReturnTo(
    cookieStore.get(OAUTH_RETURN_COOKIE)?.value ?? "/app",
  );

  if (!code || !secretsMatch(expectedState, state) || !expectedNonce) {
    await clearOAuthCookies();
    redirect("/signin?error=state");
  }

  const origin = requestOrigin(request);
  let user: SessionUser | null = null;
  try {
    const idToken = await exchangeCode({
      code,
      clientId: config.auth.googleClientId,
      clientSecret: config.auth.googleClientSecret,
      redirectUri: googleCallbackUrl(origin),
    });
    if (idToken) {
      user = await verifyIdentity(idToken, config.auth.googleClientId, expectedNonce);
    }
  } catch {
    user = null;
  }

  if (!user) {
    await clearOAuthCookies();
    redirect("/signin?error=oauth");
  }

  await setSessionCookie(origin, user, config.auth.secret);
  await clearOAuthCookies();
  redirect(returnTo);
}
