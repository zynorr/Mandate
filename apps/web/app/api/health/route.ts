import { readSourceHealth } from "@/lib/source-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await readSourceHealth();
    return Response.json(
      {
        service: "mandate",
        network: "BOT Chain Bohr testnet",
        chainId: 968,
        ...health,
      },
      {
        status: health.status === "down" ? 503 : 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      {
        service: "mandate",
        status: "down",
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Source health could not be checked.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
