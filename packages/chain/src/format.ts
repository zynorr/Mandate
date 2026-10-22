import { formatEther, formatUnits } from "viem";
import { NATIVE_TRANSFER_LABEL, NATIVE_TRANSFER_SELECTOR } from "./constants";

export function shortenAddress(address: string, visible = 4): string {
  if (address.length <= visible * 2 + 2) return address;
  return `${address.slice(0, visible + 2)}…${address.slice(-visible)}`;
}

export function shortenHash(hash: string, visible = 6): string {
  if (hash.length <= visible * 2 + 2) return hash;
  return `${hash.slice(0, visible + 2)}…${hash.slice(-visible)}`;
}

export function formatNativeValue(wei: string | null, symbol = "BOT"): string {
  if (wei === null) return "Unavailable";
  const value = formatEther(BigInt(wei));
  const trimmed = value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
  return `${trimmed} ${symbol}`;
}

export function formatTokenAmount(
  amountRaw: string,
  decimals: number,
  symbol: string | null,
): string {
  const formatted = formatUnits(BigInt(amountRaw), decimals);
  const trimmed = formatted.includes(".")
    ? formatted.replace(/0+$/, "").replace(/\.$/, "")
    : formatted;
  return `${trimmed}${symbol ? ` ${symbol}` : ""}`;
}

export function describeMethod(
  selector: string | null,
  label?: string | null,
): string {
  if (selector === null) return "Unavailable";
  if (selector === NATIVE_TRANSFER_SELECTOR) return NATIVE_TRANSFER_LABEL;
  return label?.trim() ? label : selector;
}

export function formatDateTime(value: string | null): string {
  if (value === null) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}

const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function formatCheckValue(value: string): string {
  const prefix = value.startsWith("Before ") ? "Before " : "";
  const timestamp = prefix ? value.slice(prefix.length) : value;
  if (!isoTimestamp.test(timestamp)) return value;
  return `${prefix}${formatDateTime(timestamp)}`;
}

export function formatRelative(value: string | null, now = new Date()): string {
  if (value === null) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, seconds] of thresholds) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return formatter.format(deltaSeconds, "second");
}
