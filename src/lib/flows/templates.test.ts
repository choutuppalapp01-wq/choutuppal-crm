import { describe, expect, it } from "vitest";
import {
  buildTemplateWithOverrides,
  getFlowTemplate,
  listFlowTemplates,
} from "./templates";
import { validateFlowForActivation } from "./validate";

describe("Flow Templates Foundation (Batch 02)", () => {
  const REQUIRED_SLUGS = [
    "welcome_menu",
    "welcome_menu_v2",
    "local_directory",
    "my_business",
    "premium_listing",
    "promotion_services",
    "real_estate",
    "jobs",
    "service_catalog",
    "faq_bot",
    "lead_capture",
  ];

  it("registers all 11 starter and production templates", () => {
    const all = listFlowTemplates();
    expect(all).toHaveLength(11);
    const slugs = all.map((t) => t.slug);
    for (const slug of REQUIRED_SLUGS) {
      expect(slugs).toContain(slug);
      const found = getFlowTemplate(slug);
      expect(found).not.toBeNull();
      expect(found?.slug).toBe(slug);
    }
  });

  describe("Graph validation and Meta API limits", () => {
    it.each(REQUIRED_SLUGS)(
      "template %s passes validateFlowForActivation with zero errors or warnings",
      (slug) => {
        const template = getFlowTemplate(slug);
        expect(template).not.toBeNull();
        if (!template) return;

        const issues = validateFlowForActivation(
          {
            name: template.name,
            trigger_type: template.trigger_type,
            trigger_config: template.trigger_config as Record<string, unknown>,
            entry_node_id: template.entry_node_id,
          },
          template.nodes as Array<{
            node_key: string;
            node_type: string;
            config: Record<string, unknown>;
          }>,
        );

        // Every node must be valid, reachable, and within Meta limits
        expect(issues).toEqual([]);
      },
    );

    it("verifies interactive button titles are within 20 chars across all templates", () => {
      const all = listFlowTemplates();
      for (const t of all) {
        for (const n of t.nodes) {
          if (n.node_type === "send_buttons") {
            const buttons = (n.config as { buttons?: Array<{ title: string }> }).buttons ?? [];
            expect(buttons.length).toBeGreaterThanOrEqual(1);
            expect(buttons.length).toBeLessThanOrEqual(3);
            for (const b of buttons) {
              expect(b.title.trim().length).toBeGreaterThan(0);
              expect(b.title.length).toBeLessThanOrEqual(20);
            }
          }
        }
      }
    });

    it("verifies interactive list items and limits across list nodes", () => {
      const all = listFlowTemplates();
      for (const t of all) {
        for (const n of t.nodes) {
          if (n.node_type === "send_list") {
            const cfg = n.config as {
              sections?: Array<{ rows?: Array<{ title: string; description?: string }> }>;
            };
            const sections = cfg.sections ?? [];
            const allRows = sections.flatMap((s) => s.rows ?? []);
            expect(allRows.length).toBeGreaterThanOrEqual(1);
            expect(allRows.length).toBeLessThanOrEqual(10);
            for (const row of allRows) {
              expect(row.title.trim().length).toBeGreaterThan(0);
              expect(row.title.length).toBeLessThanOrEqual(24);
              if (row.description) {
                expect(row.description.length).toBeLessThanOrEqual(72);
              }
            }
          }
        }
      }
    });
  });

  describe("buildTemplateWithOverrides and Orphan Protection", () => {
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
      const edges = (nodes: NonNullable<typeof base>["nodes"]) =>
        nodes.flatMap((node) => {
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
        {
          reply_id: "csv_override_button_2",
          title: "వ్యాపారాలు",
          next_node_key: "csv_override_handoff_2",
        },
        {
          reply_id: "csv_override_button_3",
          title: "సహాయం",
          next_node_key: "csv_override_handoff_3",
        },
      ]);
      expect(resultNodes.has("handoff_1")).toBe(true);
    });

    it("safely prunes orphaned subtrees when overriding with fewer buttons", () => {
      // welcome_menu_v2 has 3 initial buttons: btn_dir, btn_biz, btn_more
      const base = getFlowTemplate("welcome_menu_v2");
      expect(base).not.toBeNull();
      const baseNodeCount = base!.nodes.length;

      // Override with only 1 button: "డైరెక్టరీ మాత్రమే"
      const pruned = buildTemplateWithOverrides("welcome_menu_v2", {
        name: "Single Button Gateway",
        button_options: ["డైరెక్టరీ మాత్రమే"],
      });

      expect(pruned).not.toBeNull();
      if (!pruned) return;

      // Unreachable branches (goto_business, goto_more_services, services_info) should be pruned
      expect(pruned.nodes.length).toBeLessThan(baseNodeCount);

      // Node keys that must still exist (connected via goto_directory branch):
      const keys = pruned.nodes.map((n) => n.node_key);
      expect(keys).toContain("start");
      expect(keys).toContain("welcome_intro");
      expect(keys).toContain("goto_directory");
      expect(keys).toContain("send_app_vcard");
      expect(keys).toContain("vcard_completion");
      expect(keys).toContain("end_welcome");

      // Pruned disconnected keys:
      expect(keys).not.toContain("goto_business");
      expect(keys).not.toContain("goto_more_services");
      expect(keys).not.toContain("services_info");

      // And it MUST pass full validation with 0 issues:
      const issues = validateFlowForActivation(
        {
          name: pruned.name,
          trigger_type: pruned.trigger_type,
          trigger_config: pruned.trigger_config as Record<string, unknown>,
          entry_node_id: pruned.entry_node_id,
        },
        pruned.nodes as Array<{
          node_key: string;
          node_type: string;
          config: Record<string, unknown>;
        }>,
      );
      expect(issues).toEqual([]);
    });

    it("returns null for an unknown template", () => {
      expect(buildTemplateWithOverrides("missing", {})).toBeNull();
    });

    it("fails unsafe button overrides without mutating the original template", () => {
      const before = JSON.stringify(getFlowTemplate("welcome_menu"));
      expect(() =>
        buildTemplateWithOverrides("welcome_menu", {
          button_options: ["x".repeat(21)],
        }),
      ).toThrow("20 characters");
      expect(JSON.stringify(getFlowTemplate("welcome_menu"))).toBe(before);
    });

    it("ensures cloned templates are isolated from mutations to other instances", () => {
      const clone1 = buildTemplateWithOverrides("welcome_menu_v2", {
        name: "Instance 1",
        initial_message: "Custom intro 1",
      });
      const clone2 = buildTemplateWithOverrides("welcome_menu_v2", {
        name: "Instance 2",
        initial_message: "Custom intro 2",
      });

      expect(clone1?.name).toBe("Instance 1");
      expect(clone2?.name).toBe("Instance 2");

      const intro1 = clone1?.nodes.find((n) => n.node_key === "welcome_intro");
      const intro2 = clone2?.nodes.find((n) => n.node_key === "welcome_intro");
      expect((intro1?.config as { text: string }).text).toBe("Custom intro 1");
      expect((intro2?.config as { text: string }).text).toBe("Custom intro 2");

      // Base template remains untouched
      const freshBase = getFlowTemplate("welcome_menu_v2");
      const baseIntro = freshBase?.nodes.find((n) => n.node_key === "welcome_intro");
      expect((baseIntro?.config as { text: string }).text).toContain("నమస్కారం! 🙏");
    });
  });
});
