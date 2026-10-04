import { describe, expect, it, vi } from "vitest";
import {
  buildFlowGraphFromRow,
  buildImportFlowNodes,
  importFlowCsvRow,
  importFlowCsvRows,
  previewFlowCsvRows,
} from "./import-flow-row";
import { parseFlowCsv, type ParsedFlowRow } from "./parse-flow-csv";
import { validateFlowForActivation } from "./validate";
import { getFlowTemplate } from "./templates";

const templateRow: ParsedFlowRow = {
  name: "Welcome Menu",
  description: "Customer-specific description",
  trigger_type: "keyword",
  trigger_keywords: ["Hi", "hi", "Hello", "నమస్కారం", "హాయ్"],
  initial_message: "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!",
  button_options: ["సేవలు", "వ్యాపారాలు", "సహాయం"],
  template_slug: "welcome_menu",
  rawLineIndex: 2,
};

type MockFetcher = typeof fetch & { mock: { calls: unknown[][] } };

function fetchMock(...responses: Response[]) {
  return vi.fn(async () =>
    responses.shift() ?? Response.json({ error: "unexpected request" }, { status: 500 }),
  ) as unknown as MockFetcher;
}

describe("Batch 03 — Safe Flow Import Pipeline", () => {
  describe("flow CSV import requests & API communication", () => {
    it("sends every CSV override to template creation", async () => {
      const request = fetchMock(Response.json({ flow: { id: "flow-1" } }, { status: 201 }));
      await importFlowCsvRow(templateRow, request);

      const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("/api/flows");
      expect(JSON.parse(init.body as string)).toEqual({
        name: "Welcome Menu",
        description: "Customer-specific description",
        trigger_type: "keyword",
        trigger_keywords: ["Hi", "hi", "Hello", "నమస్కారం", "హాయ్"],
        initial_message: "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!",
        button_options: ["సేవలు", "వ్యాపారాలు", "సహాయం"],
        template_slug: "welcome_menu",
      });
      expect(request).toHaveBeenCalledTimes(1);
    });

    it("counts failed POSTs as failures and keeps the API error", async () => {
      const request = fetchMock(
        Response.json({ error: 'Unknown template_slug "bad"' }, { status: 400 }),
      );
      const result = await importFlowCsvRows([templateRow], request);
      expect(result).toEqual({
        imported: 0,
        failed: 1,
        errors: ['"Welcome Menu": Unknown template_slug "bad"'],
      });
    });

    it("counts rejected API requests as failures instead of imports", async () => {
      const request = vi
        .fn()
        .mockRejectedValue(new Error("Network unavailable")) as unknown as typeof fetch;
      const result = await importFlowCsvRows([templateRow], request);

      expect(result).toEqual({
        imported: 0,
        failed: 1,
        errors: ['"Welcome Menu": Network unavailable'],
      });
    });

    it("counts failed non-template PUTs as failures", async () => {
      const row: ParsedFlowRow = {
        name: "Simple welcome",
        trigger_type: "keyword",
        trigger_keywords: ["hello"],
        initial_message: "Custom greeting",
        rawLineIndex: 2,
      };
      const request = fetchMock(
        Response.json({ flow: { id: "flow-2" } }, { status: 201 }),
        Response.json({ error: "Node update failed" }, { status: 500 }),
      );
      const result = await importFlowCsvRows([row], request);
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain("Node update failed");
      expect(request).toHaveBeenCalledTimes(2);
    });

    it("keeps existing non-template imports and exact initial text", async () => {
      const row: ParsedFlowRow = {
        name: "Plain import",
        trigger_type: "keyword",
        trigger_keywords: ["Hi", "hello"],
        initial_message: "  Custom greeting\\ncontinued  ",
        button_options: ["Support", "Sales"],
        rawLineIndex: 2,
      };
      const request = fetchMock(
        Response.json({ flow: { id: "flow-3" } }, { status: 201 }),
        Response.json({ ok: true }),
      );
      await importFlowCsvRow(row, request);

      const [, postInit] = request.mock.calls[0] as unknown as [string, RequestInit];
      const [, putInit] = request.mock.calls[1] as unknown as [string, RequestInit];
      const payload = JSON.parse(postInit.body as string);
      const graph = JSON.parse(putInit.body as string);
      expect(payload.trigger_config).toEqual({ keywords: ["Hi", "hello"], match_type: "contains" });
      expect(
        graph.nodes.find((node: { node_key: string }) => node.node_key === "welcome_msg").config,
      ).toMatchObject({
        text: row.initial_message,
        buttons: [
          { title: "Support", next_node_key: "action_1" },
          { title: "Sales", next_node_key: "action_2" },
        ],
      });
      expect(
        graph.nodes.find((node: { node_key: string }) => node.node_key === "action_1").config,
      ).toMatchObject({
        next_node_key: "end",
      });
      expect(
        graph.nodes.find((node: { node_key: string }) => node.node_key === "action_2").config,
      ).toMatchObject({
        next_node_key: "end",
      });
      expect(
        graph.nodes.find((node: { node_key: string }) => node.node_key === "end"),
      ).toMatchObject({
        node_key: "end",
        node_type: "end",
      });
    });

    it("builds a fully valid graph with buttons that passes activation validation", () => {
      const row: ParsedFlowRow = {
        name: "Menu with 3 actions",
        trigger_type: "keyword",
        trigger_keywords: ["start", "menu"],
        initial_message: "Choose an option:",
        button_options: ["Billing", "Technical", "Sales"],
        rawLineIndex: 2,
      };
      const nodes = buildImportFlowNodes(row);

      expect(nodes.map((n) => n.node_key)).toEqual([
        "start",
        "welcome_msg",
        "action_1",
        "action_2",
        "action_3",
        "end",
      ]);

      expect(
        (nodes.find((n) => n.node_key === "action_1")?.config as { next_node_key: string })
          .next_node_key,
      ).toBe("end");
      expect(
        (nodes.find((n) => n.node_key === "action_2")?.config as { next_node_key: string })
          .next_node_key,
      ).toBe("end");
      expect(
        (nodes.find((n) => n.node_key === "action_3")?.config as { next_node_key: string })
          .next_node_key,
      ).toBe("end");

      const issues = validateFlowForActivation(
        {
          name: row.name,
          trigger_type: row.trigger_type,
          trigger_config: { keywords: row.trigger_keywords, match_type: "contains" },
          entry_node_id: "start",
        },
        nodes,
      );

      expect(issues).toEqual([]);
    });

    it("builds a fully valid graph without buttons that passes activation validation", () => {
      const row: ParsedFlowRow = {
        name: "Greeting only",
        trigger_type: "keyword",
        trigger_keywords: ["hello"],
        initial_message: "Welcome to Choutuppal CRM!",
        rawLineIndex: 2,
      };
      const nodes = buildImportFlowNodes(row);

      expect(nodes.map((n) => n.node_key)).toEqual(["start", "welcome_msg", "end"]);

      expect(
        (nodes.find((n) => n.node_key === "welcome_msg")?.config as { next_node_key: string })
          .next_node_key,
      ).toBe("end");
      expect(nodes.find((n) => n.node_key === "end")).toEqual({
        node_key: "end",
        node_type: "end",
        config: {},
        position_x: 100,
        position_y: 380,
      });

      const issues = validateFlowForActivation(
        {
          name: row.name,
          trigger_type: row.trigger_type,
          trigger_config: { keywords: row.trigger_keywords, match_type: "contains" },
          entry_node_id: "start",
        },
        nodes,
      );

      expect(issues).toEqual([]);
    });
  });

  describe("CSV validation & parser safety", () => {
    it("rejects empty CSV content with structured line-numbered error", () => {
      const parsed = parseFlowCsv("");
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors).toEqual([
        { line: 1, message: "File is empty or missing data rows." },
      ]);
    });

    it("rejects CSV missing required columns (name or trigger_type)", () => {
      const parsed = parseFlowCsv("title,type\nTest Flow,keyword");
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.hasNameColumn).toBe(false);
      expect(parsed.hasTriggerTypeColumn).toBe(false);
      expect(parsed.errors[0].message).toContain("Missing required columns");
    });

    it("rejects invalid trigger_type", () => {
      const csv = "name,trigger_type\nInvalid Trigger Flow,unsupported_trigger";
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain('Invalid trigger_type "unsupported_trigger"');
    });

    it("rejects button count > 3", () => {
      const csv =
        "name,trigger_type,button_options\nFour Buttons,keyword,One;Two;Three;Four";
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain("at most 3 labels");
    });

    it("rejects button label length > 20 characters", () => {
      const longLabel = "This label is definitely longer than twenty characters";
      const csv = `name,trigger_type,button_options\nLong Label,keyword,"${longLabel}"`;
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain("20 characters");
    });

    it("rejects empty button label in semicolon-delimited list", () => {
      const csv = "name,trigger_type,button_options\nEmpty Button,keyword,Button1;;Button3";
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain("empty labels");
    });

    it("rejects unknown template_slug with a structured error", () => {
      const csv = "name,trigger_type,template_slug\nBad Template,keyword,nonexistent_template";
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain('Unknown template_slug "nonexistent_template"');
    });

    it("rejects physical unclosed newlines inside records", () => {
      const csv = 'name,trigger_type,initial_message\nUnclosed,keyword,"Line 1\nLine 2"';
      const parsed = parseFlowCsv(csv);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.errors[0].message).toContain("Physical newlines inside quoted CSV records are not supported");
    });
  });

  describe("Template integration & validation across all 7 Batch 02 templates", () => {
    const TEMPLATE_SLUGS = [
      "welcome_menu_v2",
      "local_directory",
      "my_business",
      "premium_listing",
      "promotion_services",
      "real_estate",
      "jobs",
    ];

    it.each(TEMPLATE_SLUGS)(
      "successfully builds and validates template '%s' from CSV row",
      (slug) => {
        const row: ParsedFlowRow = {
          name: `Custom ${slug}`,
          trigger_type: "keyword",
          trigger_keywords: ["start", "test", slug],
          template_slug: slug,
          rawLineIndex: 2,
        };

        const graph = buildFlowGraphFromRow(row);
        expect(graph.nodes.length).toBeGreaterThan(0);
        expect(graph.entry_node_id).toBe("start");

        const issues = validateFlowForActivation(
          {
            name: graph.name,
            trigger_type: graph.trigger_type,
            trigger_config: graph.trigger_config,
            entry_node_id: graph.entry_node_id,
          },
          graph.nodes,
        );

        expect(issues).toEqual([]);
      },
    );

    it("preserves Batch 02 orphan protection when overriding template buttons with fewer options", () => {
      const row: ParsedFlowRow = {
        name: "Pruned Welcome Menu",
        trigger_type: "keyword",
        trigger_keywords: ["hi"],
        template_slug: "welcome_menu_v2",
        button_options: ["డైరెక్టరీ"],
        rawLineIndex: 2,
      };

      const baseTemplate = getFlowTemplate("welcome_menu_v2");
      expect(baseTemplate).not.toBeNull();

      const graph = buildFlowGraphFromRow(row);
      // Orphan protection should prune disconnected branches
      expect(graph.nodes.length).toBeLessThan(baseTemplate!.nodes.length);

      const issues = validateFlowForActivation(
        {
          name: graph.name,
          trigger_type: graph.trigger_type,
          trigger_config: graph.trigger_config,
          entry_node_id: graph.entry_node_id,
        },
        graph.nodes,
      );

      // Must be 100% valid with 0 errors or warnings
      expect(issues).toEqual([]);
    });
  });

  describe("Preview flow graph (dry-run)", () => {
    it("generates a preview item with node_count, edge_count, and valid status", () => {
      const rows: ParsedFlowRow[] = [
        {
          name: "Standard Welcome",
          trigger_type: "keyword",
          trigger_keywords: ["hi"],
          initial_message: "Hello!",
          button_options: ["Help", "Sales"],
          rawLineIndex: 2,
        },
        {
          name: "Directory Flow",
          trigger_type: "keyword",
          trigger_keywords: ["directory"],
          template_slug: "local_directory",
          rawLineIndex: 3,
        },
      ];

      const preview = previewFlowCsvRows(rows);
      expect(preview).toHaveLength(2);

      expect(preview[0]).toMatchObject({
        row: 2,
        name: "Standard Welcome",
        trigger_type: "keyword",
        node_count: 5, // start, welcome_msg, action_1, action_2, end
        edge_count: 5,
        valid: true,
        issues: [],
      });

      expect(preview[1]).toMatchObject({
        row: 3,
        name: "Directory Flow",
        trigger_type: "keyword",
        template_slug: "local_directory",
        valid: true,
        issues: [],
      });
      expect(preview[1].node_count).toBeGreaterThan(5);
    });

    it("pre-validation blocks invalid graph before issuing any POST request", async () => {
      const badRow: ParsedFlowRow = {
        name: "Bad Flow",
        trigger_type: "keyword",
        trigger_keywords: [], // Empty keywords causes validation error
        initial_message: "Hello",
        rawLineIndex: 2,
      };

      const request = fetchMock();
      await expect(importFlowCsvRow(badRow, request)).rejects.toThrow("validation failed");
      // Zero HTTP requests sent because pre-validation blocked it
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe("Security and Account Isolation", () => {
    it("treats CSV input as purely declarative data without code evaluation", async () => {
      const scriptInjectionRow: ParsedFlowRow = {
        name: "<script>alert('xss')</script>",
        trigger_type: "keyword",
        trigger_keywords: ["${process.env.DATABASE_URL}", "DROP TABLE flows;"],
        initial_message: "{{constructor.constructor('return process')()}}",
        rawLineIndex: 2,
      };

      const request = fetchMock(
        Response.json({ flow: { id: "flow-sec" } }, { status: 201 }),
        Response.json({ ok: true }),
      );

      await importFlowCsvRow(scriptInjectionRow, request);

      const [, postInit] = request.mock.calls[0] as unknown as [string, RequestInit];
      const payload = JSON.parse(postInit.body as string);
      // Literal text stored safely as strings
      expect(payload.name).toBe("<script>alert('xss')</script>");
      expect(payload.initial_message).toBe("{{constructor.constructor('return process')()}}");
    });
  });
});
