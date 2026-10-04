import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAGS,
  getAllFeatureFlags,
  isFeatureEnabled,
} from "./flags";

describe("feature flags", () => {
  it("defaults all flags safely to false", () => {
    const flags = getAllFeatureFlags({});
    for (const [flag, value] of Object.entries(flags)) {
      expect(value, `Flag ${flag} should default to false`).toBe(false);
    }
  });

  it("enables flag when environment variable is set to true or 1", () => {
    expect(
      isFeatureEnabled(FEATURE_FLAGS.FEATURE_WELCOME, {
        FEATURE_WELCOME: "true",
      }),
    ).toBe(true);

    expect(
      isFeatureEnabled(FEATURE_FLAGS.FEATURE_DIRECTORY, {
        FEATURE_DIRECTORY: "1",
      }),
    ).toBe(true);
  });

  it("keeps flag disabled when environment variable is set to false or 0", () => {
    expect(
      isFeatureEnabled(FEATURE_FLAGS.FEATURE_VENDOR, {
        FEATURE_VENDOR: "false",
      }),
    ).toBe(false);

    expect(
      isFeatureEnabled(FEATURE_FLAGS.FEATURE_PREMIUM, {
        FEATURE_PREMIUM: "0",
      }),
    ).toBe(false);
  });

  it("handles case-insensitive and trimmed env values", () => {
    expect(
      isFeatureEnabled(FEATURE_FLAGS.FEATURE_AI_INTENT, {
        FEATURE_AI_INTENT: "  TRUE  ",
      }),
    ).toBe(true);
  });

  it("returns a snapshot of all flags with active overrides", () => {
    const snapshot = getAllFeatureFlags({
      FEATURE_WELCOME: "true",
      FEATURE_AI_INTENT: "1",
    });

    expect(snapshot.FEATURE_WELCOME).toBe(true);
    expect(snapshot.FEATURE_AI_INTENT).toBe(true);
    expect(snapshot.FEATURE_PROMOTION).toBe(false);
  });
});
