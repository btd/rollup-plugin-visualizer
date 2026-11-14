export class ShareError extends Error {
  constructor(
    public readonly code:
      "invalid-report" | "unsupported-version" | "resource-limit" | "unsupported-browser",
    message: string,
  ) {
    super(message);
    this.name = "ShareError";
  }
}

export interface ShareLimits {
  maxFileBytes: number;
  maxBinaryBytes: number;
  maxCompressedBytes: number;
  maxTextBytes: number;
  maxRecords: number;
  maxEntries: number;
  maxTreeDepth: number;
  maxJsonDepth: number;
  maxExtensions: number;
}

// Processing budgets, not URL/paste limits. Large-report browser checks cover these separately.
export const DEFAULT_SHARE_LIMITS: Readonly<ShareLimits> = Object.freeze({
  maxFileBytes: 64 * 1024 * 1024,
  maxBinaryBytes: 64 * 1024 * 1024,
  maxCompressedBytes: 65 * 1024 * 1024,
  maxTextBytes: 64 * 1024 * 1024,
  maxRecords: 250_000,
  maxEntries: 2_000_000,
  maxTreeDepth: 256,
  maxJsonDepth: 64,
  maxExtensions: 1024,
});

export const resolveLimits = (overrides: Partial<ShareLimits> = {}): ShareLimits => {
  const limits = { ...DEFAULT_SHARE_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Invalid ${key} budget`);
  }
  return limits;
};

export const invalid = (message: string): never => {
  throw new ShareError("invalid-report", message);
};

export const budget = (value: number, maximum: number, name: string): void => {
  if (value > maximum)
    throw new ShareError("resource-limit", `${name} exceeds the processing limit.`);
};

export const uint = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return invalid("Expected a nonnegative safe integer size, count, or reference.");
  }
  return value;
};

export const own = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const setOwn = <T>(target: Record<string, T>, key: string, value: T): void => {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
};

export const boolState = (value: object, key: string): number =>
  own(value, key) ? ((value as Record<string, unknown>)[key] ? 2 : 1) : 0;

export const putBool = (value: object, key: string, state: number): void => {
  if (state > 2) invalid("Invalid optional boolean state.");
  if (state)
    Object.defineProperty(value, key, {
      value: state === 2,
      enumerable: true,
      writable: true,
      configurable: true,
    });
};
