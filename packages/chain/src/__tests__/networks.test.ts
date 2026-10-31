import { describe, expect, it } from "vitest";
import {
  BOT_MAINNET,
  BOT_MAINNET_CHAIN_ID,
  BOT_TESTNET,
  BOT_TESTNET_CHAIN_ID,
  isKnownChainId,
  networkFor,
  networkLabel,
  networkName,
} from "../constants";
import { policyDraftSchema } from "../schemas";

describe("BOT Chain network registry", () => {
  it("supports mainnet 677 and testnet 968 only", () => {
    expect(isKnownChainId(BOT_MAINNET_CHAIN_ID)).toBe(true);
    expect(isKnownChainId(BOT_TESTNET_CHAIN_ID)).toBe(true);
    expect(isKnownChainId(1)).toBe(false);
    expect(isKnownChainId(56)).toBe(false);
    expect(networkFor(677)).toEqual(BOT_MAINNET);
    expect(networkFor(968)).toEqual(BOT_TESTNET);
    expect(networkFor(1)).toBeNull();
  });

  it("exposes official endpoints per network", () => {
    expect(BOT_MAINNET.rpcUrl).toBe("https://rpc.botchain.ai");
    expect(BOT_MAINNET.bundlerUrl).toBe("https://bundler.botchain.ai/rpc/");
    expect(BOT_MAINNET.explorerUrl).toBe("https://scan.botchain.ai");
    expect(BOT_TESTNET.rpcUrl).toBe("https://rpc.bohr.life");
    expect(BOT_MAINNET.entryPointAddress).toBe(
      BOT_TESTNET.entryPointAddress,
    );
  });

  it("labels networks for UI copy", () => {
    expect(networkLabel(BOT_MAINNET_CHAIN_ID)).toBe("BOT Chain mainnet");
    expect(networkLabel(BOT_TESTNET_CHAIN_ID)).toBe("BOT Chain testnet");
    expect(networkName(BOT_MAINNET_CHAIN_ID)).toBe("BOT Chain Mainnet");
    expect(networkName(BOT_TESTNET_CHAIN_ID)).toBe(
      "BOT Chain Bohr Testnet",
    );
    expect(networkLabel(1)).toBe("Chain 1");
  });
});

describe("policy schema chain IDs", () => {
  const draft = {
    name: "Mainnet policy",
    chainId: BOT_MAINNET_CHAIN_ID,
    allowedTargets: ["0x3333333333333333333333333333333333333333"],
    allowedMethods: ["0xa9059cbb"],
    maxNativeValuePerActionWei: "0",
    maxNativeValuePerDayWei: null,
    expiresAt: null,
    notes: "",
  };

  it("accepts mainnet and testnet chain IDs", () => {
    expect(policyDraftSchema.safeParse(draft).success).toBe(true);
    expect(
      policyDraftSchema.safeParse({ ...draft, chainId: BOT_TESTNET_CHAIN_ID })
        .success,
    ).toBe(true);
  });

  it("rejects unsupported chain IDs", () => {
    expect(policyDraftSchema.safeParse({ ...draft, chainId: 1 }).success).toBe(
      false,
    );
    expect(
      policyDraftSchema.safeParse({ ...draft, chainId: 31337 }).success,
    ).toBe(false);
  });
});
