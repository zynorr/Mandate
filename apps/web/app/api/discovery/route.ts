import { getSessionUser } from "@/lib/auth";
import { discoverAgentActivity } from "@/lib/discovery";
import { getAgent } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { error: "Sign in to discover agent activity." },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": "GitHub",
        },
      },
    );
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId")?.trim();
  if (!agentId) {
    return Response.json(
      { error: "Provide an agentId query parameter." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const agent = await getAgent(user.ownerId, agentId);
  if (!agent) {
    return Response.json(
      { error: "Agent not found." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  const rawLimit = Number(url.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 25)
    : 12;
  const discovery = await discoverAgentActivity(user.ownerId, agent, limit);

  return Response.json(
    {
      agent: {
        id: agent.id,
        name: agent.name,
        smartAccount: agent.smartAccount,
        isDemo: agent.isDemo,
      },
      ...discovery,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
