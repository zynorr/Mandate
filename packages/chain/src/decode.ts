import { decodeAbiParameters, getAddress, isAddress } from "viem";
import {
  KNOWN_METHODS,
  NATIVE_TRANSFER_LABEL,
  NATIVE_TRANSFER_SELECTOR,
} from "./constants";

export type DecodedCall =
  | {
      kind: "decoded";
      target: `0x${string}`;
      valueWei: string;
      methodSelector: string | null;
      methodLabel: string | null;
      source: "decoded_inner" | "outer";
      notes: string[];
    }
  | {
      kind: "undecoded";
      reason: string;
    };

const HEX = /^0x[0-9a-fA-F]*$/;

function labelFor(selector: string | null): string | null {
  if (selector === null) return null;
  return KNOWN_METHODS[selector] ?? null;
}

function selectorFromCalldata(calldata: string): string | null {
  if (calldata === "0x") return NATIVE_TRANSFER_SELECTOR;
  if (!HEX.test(calldata) || calldata.length < 10) return null;
  return calldata.slice(0, 10).toLowerCase();
}

function readDynamicBytes(
  argsHex: string,
  headOffsetBytes: number,
): `0x${string}` | null {
  const head = headOffsetBytes * 2;
  if (argsHex.length < head + 64) return null;
  const offset = Number(BigInt(`0x${argsHex.slice(head, head + 64)}`));
  if (!Number.isSafeInteger(offset)) return null;
  const position = offset * 2;
  if (position + 64 > argsHex.length) return null;
  const length = Number(
    BigInt(`0x${argsHex.slice(position, position + 64)}`),
  );
  if (!Number.isSafeInteger(length)) return null;
  const start = position + 64;
  const end = start + length * 2;
  if (end > argsHex.length) return null;
  return `0x${argsHex.slice(start, end)}`;
}

function decoded(
  target: string,
  valueWei: bigint,
  calldata: string,
  source: "decoded_inner" | "outer",
  notes: string[],
): DecodedCall {
  if (!isAddress(target, { strict: false })) {
    return { kind: "undecoded", reason: "The decoded target is not an address." };
  }
  const methodSelector = selectorFromCalldata(calldata);
  const methodLabel = labelFor(methodSelector);
  if (methodSelector === null) {
    notes.push("The inner calldata is too short to contain a function selector.");
  } else if (methodLabel === null && methodSelector !== NATIVE_TRANSFER_SELECTOR) {
    notes.push(
      "The selector is not in Mandate's known-method registry. Compare it against the approved selector manually.",
    );
  }
  return {
    kind: "decoded",
    target: getAddress(target),
    valueWei: valueWei.toString(),
    methodSelector,
    methodLabel,
    source,
    notes,
  };
}

function decodeKernelExecute(callData: `0x${string}`): DecodedCall {
  const body = callData.slice(10);
  if (body.length < 128) {
    return {
      kind: "undecoded",
      reason: "The Kernel execute envelope is too short to decode safely.",
    };
  }
  const mode = body.slice(0, 64);
  const callType = Number.parseInt(mode.slice(0, 2), 16);
  const executionCalldata = readDynamicBytes(body, 32);
  if (executionCalldata === null) {
    return {
      kind: "undecoded",
      reason: "The Kernel execution payload could not be read from the envelope.",
    };
  }
  const payload = executionCalldata.slice(2);

  if (callType === 0x00) {
    if (payload.length < 104) {
      return {
        kind: "undecoded",
        reason: "The Kernel single-call payload is incomplete.",
      };
    }
    const target = `0x${payload.slice(0, 40)}`;
    const value = BigInt(`0x${payload.slice(40, 104)}`);
    const innerCalldata = payload.length > 104 ? `0x${payload.slice(104)}` : "0x";
    return decoded(target, value, innerCalldata, "decoded_inner", [
      "Inner call decoded locally from a Kernel single-call execute envelope.",
    ]);
  }

  if (callType === 0x01) {
    try {
      const [calls] = decodeAbiParameters(
        [
          {
            name: "calls",
            type: "tuple[]",
            components: [
              { name: "target", type: "address" },
              { name: "value", type: "uint256" },
              { name: "callData", type: "bytes" },
            ],
          },
        ],
        executionCalldata,
      );
      if (calls.length !== 1) {
        return {
          kind: "undecoded",
          reason: `The Kernel batch contains ${calls.length} calls. Mandate compares one inner call per intent, so the inner target is not inferred.`,
        };
      }
      const call = calls[0];
      if (!call) {
        return { kind: "undecoded", reason: "The Kernel batch payload is empty." };
      }
      return decoded(call.target, call.value, call.callData, "decoded_inner", [
        "Inner call decoded locally from a single-item Kernel batch.",
      ]);
    } catch {
      return {
        kind: "undecoded",
        reason: "The Kernel batch payload could not be decoded.",
      };
    }
  }

  if (callType === 0xff) {
    return {
      kind: "undecoded",
      reason:
        "This account used a delegatecall mode. Mandate does not treat delegatecall payloads as normal actions.",
    };
  }

  return {
    kind: "undecoded",
    reason: `Kernel call type 0x${callType.toString(16)} is not supported.`,
  };
}

function decodeSimpleAccountExecute(callData: `0x${string}`): DecodedCall {
  const args = `0x${callData.slice(10)}` as `0x${string}`;
  try {
    const [target, value, innerCalldata] = decodeAbiParameters(
      [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
      args,
    );
    return decoded(target, value, innerCalldata, "decoded_inner", [
      "Inner call decoded locally from a SimpleAccount execute envelope.",
    ]);
  } catch {
    return {
      kind: "undecoded",
      reason: "The SimpleAccount execute envelope could not be decoded.",
    };
  }
}

function decodeSimpleAccountBatch(callData: `0x${string}`): DecodedCall {
  const args = `0x${callData.slice(10)}` as `0x${string}`;
  try {
    const [targets, values, calldata] = decodeAbiParameters(
      [
        { name: "targets", type: "address[]" },
        { name: "values", type: "uint256[]" },
        { name: "data", type: "bytes[]" },
      ],
      args,
    );
    if (targets.length !== 1) {
      return {
        kind: "undecoded",
        reason: `The SimpleAccount batch contains ${targets.length} calls. Mandate compares one inner call per intent.`,
      };
    }
    const target = targets[0];
    const value = values[0];
    const innerCalldata = calldata[0];
    if (!target || value === undefined || innerCalldata === undefined) {
      return {
        kind: "undecoded",
        reason: "The SimpleAccount batch payload is incomplete.",
      };
    }
    return decoded(target, value, innerCalldata, "decoded_inner", [
      "Inner call decoded locally from a single-item SimpleAccount batch.",
    ]);
  } catch {
    return {
      kind: "undecoded",
      reason: "The SimpleAccount batch envelope could not be decoded.",
    };
  }
}

export function decodeAccountCalldata(callData: string | null): DecodedCall {
  if (callData === null || callData === "0x") {
    return {
      kind: "undecoded",
      reason: "The UserOperation has no account call data.",
    };
  }
  if (!HEX.test(callData)) {
    return {
      kind: "undecoded",
      reason: "The UserOperation call data is not valid hex.",
    };
  }
  const safeCallData = callData as `0x${string}`;
  const selector = safeCallData.slice(0, 10).toLowerCase();
  switch (selector) {
    case "0xe9ae5c53":
      return decodeKernelExecute(safeCallData);
    case "0xb61d27f6":
      return decodeSimpleAccountExecute(safeCallData);
    case "0x47e1da2a":
      return decodeSimpleAccountBatch(safeCallData);
    default:
      return {
        kind: "undecoded",
        reason: `The account call envelope ${selector} is not recognized. The inner target and method are not guessed.`,
      };
  }
}

export function decodeDirectTransaction(input: {
  to: string | null;
  input: string | null;
  valueWei: string;
}): DecodedCall {
  if (input.to === null) {
    return {
      kind: "undecoded",
      reason: "This transaction created a contract, so it has no call target.",
    };
  }
  if (input.input !== null && input.input !== "0x" && !HEX.test(input.input)) {
    return { kind: "undecoded", reason: "The transaction input is not valid hex." };
  }
  if (input.input !== null && input.input.length > 2 && input.input.length < 10) {
    return {
      kind: "undecoded",
      reason: "The transaction input is too short to contain a selector.",
    };
  }
  return decoded(
    input.to,
    BigInt(input.valueWei),
    input.input ?? "0x",
    "outer",
    ["Target and selector read from the outer transaction."],
  );
}
