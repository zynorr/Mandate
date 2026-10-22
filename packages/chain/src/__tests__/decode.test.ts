import { encodeAbiParameters, encodeFunctionData, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { decodeAccountCalldata, decodeDirectTransaction } from "../decode";
import {
  SAMPLE_CALL_DATA,
  SAMPLE_INNER_SELECTOR,
  SAMPLE_INNER_TARGET,
} from "./fixtures";

describe("decodeAccountCalldata", () => {
  it("decodes the real BOT testnet Kernel single-call envelope", () => {
    const decoded = decodeAccountCalldata(SAMPLE_CALL_DATA);
    expect(decoded.kind).toBe("decoded");
    if (decoded.kind !== "decoded") return;
    expect(decoded.target).toBe(SAMPLE_INNER_TARGET);
    expect(decoded.valueWei).toBe("0");
    expect(decoded.methodSelector).toBe(SAMPLE_INNER_SELECTOR);
    expect(decoded.source).toBe("decoded_inner");
    expect(decoded.notes.join(" ")).toContain("Kernel");
  });

  it("decodes a SimpleAccount single call", () => {
    const callData = encodeFunctionData({
      abi: parseAbi([
        "function execute(address target, uint256 value, bytes data)",
      ]),
      functionName: "execute",
      args: [
        "0x75edC9335175Fc0552D51D48439F229c10420fe3",
        42n,
        "0xa9059cbb",
      ],
    });
    const decoded = decodeAccountCalldata(callData);
    expect(decoded.kind).toBe("decoded");
    if (decoded.kind !== "decoded") return;
    expect(decoded.target).toBe("0x75edC9335175Fc0552D51D48439F229c10420fe3");
    expect(decoded.valueWei).toBe("42");
    expect(decoded.methodSelector).toBe("0xa9059cbb");
  });

  it("decodes a single-item SimpleAccount batch", () => {
    const callData = encodeFunctionData({
      abi: parseAbi([
        "function executeBatch(address[] targets, uint256[] values, bytes[] data)",
      ]),
      functionName: "executeBatch",
      args: [
        ["0x75edC9335175Fc0552D51D48439F229c10420fe3"],
        [7n],
        ["0x095ea7b3"],
      ],
    });
    const decoded = decodeAccountCalldata(callData);
    expect(decoded.kind).toBe("decoded");
    if (decoded.kind !== "decoded") return;
    expect(decoded.valueWei).toBe("7");
    expect(decoded.methodSelector).toBe("0x095ea7b3");
  });

  it("refuses to infer the target for a multi-call batch", () => {
    const callData = encodeFunctionData({
      abi: parseAbi([
        "function executeBatch(address[] targets, uint256[] values, bytes[] data)",
      ]),
      functionName: "executeBatch",
      args: [
        [
          "0x75edC9335175Fc0552D51D48439F229c10420fe3",
          "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
        ],
        [1n, 2n],
        ["0x", "0x"],
      ],
    });
    const decoded = decodeAccountCalldata(callData);
    expect(decoded.kind).toBe("undecoded");
  });

  it("does not guess unknown account envelopes", () => {
    const decoded = decodeAccountCalldata(
      `${encodeAbiParameters([{ type: "uint256" }], [1n]).slice(0, 10)}deadbeef`,
    );
    expect(decoded.kind).toBe("undecoded");
  });
});

describe("decodeDirectTransaction", () => {
  it("reads a native transfer sentinel", () => {
    const decoded = decodeDirectTransaction({
      to: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
      input: "0x",
      valueWei: "1000",
    });
    expect(decoded.kind).toBe("decoded");
    if (decoded.kind !== "decoded") return;
    expect(decoded.methodSelector).toBe("0x00000000");
    expect(decoded.valueWei).toBe("1000");
    expect(decoded.source).toBe("outer");
  });

  it("rejects contract creation", () => {
    const decoded = decodeDirectTransaction({
      to: null,
      input: SAMPLE_CALL_DATA,
      valueWei: "0",
    });
    expect(decoded.kind).toBe("undecoded");
  });
});
