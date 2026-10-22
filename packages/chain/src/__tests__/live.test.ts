import { describe, expect, it } from "vitest";
import { BOT_TESTNET } from "../constants";
import { fetchEvidence } from "../evidence";
import {
  SAMPLE_AGENT_ACCOUNT,
  SAMPLE_INNER_SELECTOR,
  SAMPLE_INNER_TARGET,
  SAMPLE_USER_OP,
} from "./fixtures";

const live = process.env.LIVE_BOT_TESTNET === "1";

describe.skipIf(!live)("live BOT testnet evidence", () => {
  it("reconstructs the sample UserOperation from BOT Scan and the Bundler", async () => {
    const evidence = await fetchEvidence({
      kind: "user_operation",
      hash: SAMPLE_USER_OP,
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      config: {
        chainId: BOT_TESTNET.chainId,
        rpcUrl: BOT_TESTNET.rpcUrl,
        bundlerUrl: BOT_TESTNET.bundlerUrl,
        explorerUrl: BOT_TESTNET.explorerUrl,
        explorerApiUrl: BOT_TESTNET.explorerApiUrl,
        entryPointAddress: BOT_TESTNET.entryPointAddress,
      },
    });

    expect(evidence.observed.chainStatus).toBe("success");
    expect(evidence.observed.target).toBe(SAMPLE_INNER_TARGET);
    expect(evidence.observed.methodSelector).toBe(SAMPLE_INNER_SELECTOR);
    expect(evidence.observed.coverage).toBe("complete");
    expect(evidence.observed.tokenMovements.length).toBeGreaterThan(0);
    expect(evidence.observed.explorerUrl).toContain("/op/");
  }, 45_000);
});
