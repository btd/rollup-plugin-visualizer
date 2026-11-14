import { budget, invalid, uint, type ShareLimits } from "./limits.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export const wellFormed = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
};

export class Writer {
  private buffer: Uint8Array;
  private position = 0;
  private textBytes = 0;

  constructor(private readonly limits: ShareLimits) {
    this.buffer = new Uint8Array(Math.min(1024, limits.maxBinaryBytes));
  }

  private reserve(size: number): void {
    const needed = this.position + size;
    budget(needed, this.limits.maxBinaryBytes, "Binary report");
    if (needed <= this.buffer.length) return;
    const replacement = new Uint8Array(
      Math.min(this.limits.maxBinaryBytes, Math.max(needed, this.buffer.length * 2)),
    );
    replacement.set(this.buffer);
    this.buffer = replacement;
  }

  byte(value: number): void {
    this.reserve(1);
    this.buffer[this.position++] = value;
  }

  uint(value: number): void {
    let n = uint(value);
    do {
      const byte = n % 128;
      n = Math.floor(n / 128);
      this.byte(byte + (n ? 128 : 0));
    } while (n);
  }

  bytes(value: Uint8Array): void {
    this.reserve(value.length);
    this.buffer.set(value, this.position);
    this.position += value.length;
  }

  accountText(size: number): void {
    this.textBytes += size;
    budget(this.textBytes, this.limits.maxTextBytes, "Report text");
  }

  text(value: string): void {
    if (!wellFormed(value)) invalid("Report text must be well-formed Unicode.");
    budget(this.textBytes + value.length, this.limits.maxTextBytes, "Report text");
    const bytes = encoder.encode(value);
    this.accountText(bytes.length);
    this.uint(bytes.length);
    this.bytes(bytes);
  }

  vector(values: readonly number[], delta = false): void {
    budget(values.length, this.limits.maxEntries, "Vector count");
    this.uint(values.length);
    if (!values.length) return;
    if (delta) {
      let previous = 0;
      for (const n of values) {
        uint(n);
        const d = n - previous;
        previous = n;
        if (!Number.isSafeInteger(d < 0 ? -2 * d - 1 : 2 * d)) {
          delta = false;
          break;
        }
      }
    }
    this.uint(delta ? 1 : 0);
    let previous = 0;
    for (const n of values) {
      const d = n - previous;
      previous = n;
      this.uint(delta ? (d < 0 ? -2 * d - 1 : 2 * d) : n);
    }
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.position);
  }
}

export class Reader {
  private position = 0;
  private textBytes = 0;

  constructor(
    private readonly buffer: Uint8Array,
    readonly limits: ShareLimits,
  ) {
    budget(buffer.length, limits.maxBinaryBytes, "Binary report");
  }

  uint(): number {
    let value = 0,
      multiplier = 1;
    for (let i = 0; i < 8; i++) {
      if (this.position >= this.buffer.length) return invalid("Truncated report.");
      const b = this.buffer[this.position++];
      value += (b % 128) * multiplier;
      uint(value);
      if (b < 128) {
        if (i && b === 0) invalid("Nonminimal integer encoding.");
        return value;
      }
      multiplier *= 128;
    }
    return invalid("Integer overflow.");
  }

  count(maximum = this.limits.maxRecords): number {
    const count = this.uint();
    budget(count, maximum, "Record count");
    return count;
  }

  bytes(size: number): Uint8Array {
    if (size > this.buffer.length - this.position) return invalid("Truncated report bytes.");
    const bytes = this.buffer.subarray(this.position, this.position + size);
    this.position += size;
    return bytes;
  }

  accountText(size: number): void {
    this.textBytes += size;
    budget(this.textBytes, this.limits.maxTextBytes, "Reconstructed text");
  }

  text(): string {
    const size = this.uint();
    this.accountText(size);
    try {
      return decoder.decode(this.bytes(size));
    } catch {
      return invalid("Invalid UTF-8 report text.");
    }
  }

  vector(expected?: number, maximum = this.limits.maxEntries): number[] {
    const count = this.count(maximum);
    if (expected !== undefined && count !== expected) return invalid("Inconsistent vector count.");
    if (count > this.buffer.length - this.position) return invalid("Truncated vector.");
    if (!count) return [];
    const mode = this.uint();
    if (mode > 1) return invalid("Unknown vector mode.");
    let previous = 0;
    return Array.from({ length: count }, () => {
      const n = this.uint();
      const value = mode ? uint(previous + (n % 2 ? -(n + 1) / 2 : n / 2)) : n;
      previous = value;
      return value;
    });
  }

  ref<T>(values: readonly T[]): T {
    const index = this.uint();
    if (index >= values.length) return invalid("Invalid table reference.");
    return values[index];
  }

  end(): void {
    if (this.position !== this.buffer.length) invalid("Trailing report bytes.");
  }
}

export const sumCounts = (values: readonly number[], limits: ShareLimits): number => {
  let sum = 0;
  for (const value of values) {
    sum += value;
    budget(sum, limits.maxEntries, "Entry count");
  }
  return sum;
};

export const reference = <T>(values: readonly T[], index: number): T => {
  if (index >= values.length) return invalid("Invalid table reference.");
  return values[index];
};
