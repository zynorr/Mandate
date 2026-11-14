import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import {
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  googleCallbackUrl,
  requestOrigin,
  safeReturnTo,
  setOAuthCookie,
} from "@/lib/auth";
import { getAppConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getAppConfig();
  const next = safeReturnTo(new URL(request.url).searchParams.get("next"));

  if (config.auth.error) redirect("/signin?error=config");
  if (config.auth.mode === "local") redirect(next);
  if (!config.auth.googleClientId || !config.auth.secret) {
    redirect("/signin?error=config");
  }

  const origin = requestOrigin(request);
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  await setOAuthCookie(OAUTH_STATE_COOKIE, state, origin);
  await setOAuthCookie(OAUTH_NONCE_COOKIE, nonce, origin);
  await setOAuthCookie(OAUTH_RETURN_COOKIE, next, origin);

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", config.auth.googleClientId);
  authorize.searchParams.set("redirect_uri", googleCallbackUrl(origin));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("access_type", "online");
  authorize.searchParams.set("prompt", "select_account");

  redirect(authorize.toString());
}
