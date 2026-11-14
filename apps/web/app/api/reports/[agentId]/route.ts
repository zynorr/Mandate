import {
  buildEvidenceReport,
  renderEvidenceReportMarkdown,
} from "@mandate/chain";
import { getSessionUser } from "@/lib/auth";
import {
  getAgent,
  listEvidence,
  listIntents,
  listPolicies,
} from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeFilename = (name: string, fallback: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { error: "Sign in to access this report." },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "www-authenticate": "Google",
        },
      },
    );
  }

  const { agentId } = await context.params;
  const agent = await getAgent(user.ownerId, agentId);
  if (!agent) {
    return Response.json(
      { error: "Agent not found." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "md" ? "md" : "json";
  const download = url.searchParams.get("download") === "1";
  const report = buildEvidenceReport({
    agent,
    policies: await listPolicies(user.ownerId, agent.id),
    intents: await listIntents(user.ownerId, agent.id),
    evidence: await listEvidence({
      ownerId: user.ownerId,
      agentId: agent.id,
      limit: 1000,
    }),
  });
  const filename = `mandate-${safeFilename(agent.name, agent.id)}-${
    report.generatedAt.slice(0, 10)
  }`;

  const headers: Record<string, string> = {
    "cache-control": "no-store",
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${filename}.${
      format === "md" ? "md" : "json"
    }"`;
  }

  if (format === "md") {
    return new Response(renderEvidenceReportMarkdown(report), {
      headers: {
        ...headers,
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  return Response.json(report, { headers });
}
