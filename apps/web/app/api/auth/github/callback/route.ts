import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  clearOAuthCookies,
  githubCallbackUrl,
  requestOrigin,
  safeReturnTo,
  setSessionCookie,
  type SessionUser,
} from "@/lib/auth";
import { getAppConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GithubProfile = {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
};

function statesMatch(expected: string, received: string): boolean {
  if (!expected || !received || expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function exchangeCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string | null> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "mandate-evidence-ledger",
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as GithubTokenResponse;
  return payload.access_token ?? null;
}

async function readProfile(accessToken: string): Promise<SessionUser | null> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "mandate-evidence-ledger",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const profile = (await response.json()) as GithubProfile;
  if (
    typeof profile.id !== "number" ||
    typeof profile.login !== "string" ||
    profile.login.length === 0
  ) {
    return null;
  }
  return {
    ownerId: `github:${profile.id}`,
    login: profile.login,
    name: typeof profile.name === "string" ? profile.name : null,
    avatarUrl:
      typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    mode: "github",
  };
}

export async function GET(request: Request) {
  const config = getAppConfig();
  if (config.auth.error) {
    redirect("/signin?error=config");
  }
  if (
    config.auth.mode !== "github" ||
    !config.auth.githubClientId ||
    !config.auth.githubClientSecret ||
    !config.auth.secret
  ) {
    redirect("/signin?error=config");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const returnTo = safeReturnTo(
    cookieStore.get(OAUTH_RETURN_COOKIE)?.value ?? "/app",
  );

  if (!code || !statesMatch(expectedState, state)) {
    await clearOAuthCookies();
    redirect("/signin?error=state");
  }

  const origin = requestOrigin(request);
  let accessToken: string | null = null;
  let user: SessionUser | null = null;
  try {
    accessToken = await exchangeCode({
      code,
      clientId: config.auth.githubClientId,
      clientSecret: config.auth.githubClientSecret,
      redirectUri: githubCallbackUrl(origin),
    });
    if (accessToken) {
      user = await readProfile(accessToken);
    }
  } catch {
    accessToken = null;
    user = null;
  }

  if (!accessToken || !user) {
    await clearOAuthCookies();
    redirect("/signin?error=oauth");
  }

  await setSessionCookie(origin, user, config.auth.secret);
  await clearOAuthCookies();
  redirect(returnTo);
}
