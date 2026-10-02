import { describe, expect, it } from "vitest";
import { buildTemplateWithOverrides, getFlowTemplate } from "./templates";

describe("buildTemplateWithOverrides", () => {
  it("applies CSV content while preserving the template graph and existing edges", () => {
    const base = getFlowTemplate("welcome_menu");
    expect(base).not.toBeNull();

    const customized = buildTemplateWithOverrides("welcome_menu", {
      name: "CSV Welcome",
      description: "Customer-specific description",
      trigger_type: "keyword",
      trigger_keywords: ["Hi", "hi", "నమస్కారం", "హాయ్"],
      initial_message: "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!",
      button_options: ["సేవలు", "వ్యాపారాలు", "సహాయం"],
    });
    expect(customized).not.toBeNull();
    expect(customized).toMatchObject({
      name: "CSV Welcome",
      description: "Customer-specific description",
      trigger_type: "keyword",
      trigger_config: { keywords: ["Hi", "hi", "నమస్కారం", "హాయ్"] },
    });

    const baseNodes = new Map(base!.nodes.map((node) => [node.node_key, node]));
    const resultNodes = new Map(customized!.nodes.map((node) => [node.node_key, node]));
    const edges = (nodes: NonNullable<typeof base>["nodes"]) => nodes.flatMap((node) => {
      const config = node.config as Record<string, unknown>;
      const directTarget = config.next_node_key;
      const buttonTargets = Array.isArray(config.buttons)
        ? config.buttons.flatMap((button) => {
            const target = (button as { next_node_key?: unknown }).next_node_key;
            return typeof target === "string" ? [[node.node_key, target]] : [];
          })
        : [];
      return [
        ...(typeof directTarget === "string" ? [[node.node_key, directTarget]] : []),
        ...buttonTargets,
      ];
    });

    expect(base!.nodes).toHaveLength(3);
    expect(customized!.nodes).toHaveLength(5);
    expect(customized!.nodes.length - base!.nodes.length).toBe(2);
    expect([...resultNodes.keys()]).toEqual(expect.arrayContaining([...baseNodes.keys()]));
    expect(edges(customized!.nodes)).toEqual([
      ["start", "welcome"],
      ["welcome", "handoff_1"],
      ["welcome", "csv_override_handoff_2"],
      ["welcome", "csv_override_handoff_3"],
    ]);
    expect(resultNodes.get("handoff_1")).toEqual(baseNodes.get("handoff_1"));
    for (const [key, original] of baseNodes) {
      expect(resultNodes.has(key)).toBe(true);
      if (key !== "welcome") expect(resultNodes.get(key)).toEqual(original);
    }

    const originalEntryConfig = baseNodes.get("welcome")!.config as Record<string, unknown>;
     const resultEntryConfig = resultNodes.get("welcome")!.config as Record<string, unknown>;
    expect(resultEntryConfig.text).toBe("నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!");
    expect(resultEntryConfig.footer_text).toBe(originalEntryConfig.footer_text);
    expect(resultEntryConfig.media_url).toBe(originalEntryConfig.media_url);
    expect(resultEntryConfig.buttons).toEqual([
      { reply_id: "btn_start", title: "సేవలు", next_node_key: "handoff_1" },
      { reply_id: "csv_override_button_2", title: "వ్యాపారాలు", next_node_key: "csv_override_handoff_2" },
      { reply_id: "csv_override_button_3", title: "సహాయం", next_node_key: "csv_override_handoff_3" },
    ]);
    expect(resultNodes.has("handoff_1")).toBe(true);
  });

  it("returns null for an unknown template", () => {
    expect(buildTemplateWithOverrides("missing", {})).toBeNull();
  });

  it("fails unsafe button overrides without mutating the original template", () => {
    const before = JSON.stringify(getFlowTemplate("welcome_menu"));
    expect(() => buildTemplateWithOverrides("welcome_menu", {
      button_options: ["x".repeat(21)],
    })).toThrow("20 characters");
    expect(JSON.stringify(getFlowTemplate("welcome_menu"))).toBe(before);
  });
});
