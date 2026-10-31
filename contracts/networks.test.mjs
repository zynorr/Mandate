import assert from "node:assert/strict";
import test from "node:test";
import {
  requireMainnetConfirmation,
  resolveDeploymentTarget,
} from "./networks.mjs";

test("deployment defaults to BOT Chain Bohr testnet", () => {
  const target = resolveDeploymentTarget({});
  assert.equal(target.network.chainId, 968);
  assert.equal(target.rpcUrl, "https://rpc.bohr.life");
});

test("mainnet target uses the configured BOT Chain mainnet RPC", () => {
  const target = resolveDeploymentTarget({ BOT_CHAIN_ID: "677" });
  assert.equal(target.network.chainId, 677);
  assert.equal(target.rpcUrl, "https://rpc.botchain.ai");
});

test("mainnet deployment rejects custom RPC overrides", () => {
  assert.throws(
    () => resolveDeploymentTarget({ BOT_CHAIN_ID: "677", BOT_RPC_URL: "https://example.invalid" }),
    /Custom RPC URLs are disabled for mainnet deployment/,
  );
});

test("mainnet deployment requires explicit confirmation", () => {
  const { network } = resolveDeploymentTarget({ BOT_CHAIN_ID: "677" });
  assert.throws(
    () => requireMainnetConfirmation(network, {}),
    /Refusing to send a mainnet transaction/,
  );
  assert.doesNotThrow(() =>
    requireMainnetConfirmation(network, { DEPLOY_CONFIRM_MAINNET: "1" }),
  );
});