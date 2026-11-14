import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import {
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  githubCallbackUrl,
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

  if (config.auth.error) {
    redirect("/signin?error=config");
  }
  if (config.auth.mode === "local") {
    redirect(next);
  }
  if (!config.auth.githubClientId || !config.auth.secret) {
    redirect("/signin?error=config");
  }

  const origin = requestOrigin(request);
  const state = randomBytes(24).toString("base64url");
  await setOAuthCookie(OAUTH_STATE_COOKIE, state, origin);
  await setOAuthCookie(OAUTH_RETURN_COOKIE, next, origin);

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", config.auth.githubClientId);
  authorize.searchParams.set("redirect_uri", githubCallbackUrl(origin));
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "true");

  redirect(authorize.toString());
}
