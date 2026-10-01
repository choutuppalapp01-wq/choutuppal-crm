import { describe, expect, it, vi } from "vitest";
import { importFlowCsvRow, importFlowCsvRows } from "./import-flow-row";
import type { ParsedFlowRow } from "./parse-flow-csv";

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

function fetchMock(...responses: Response[]) {
  return vi.fn(async () => responses.shift() ?? Response.json({ error: "unexpected request" }, { status: 500 })) as unknown as typeof fetch;
}

describe("flow CSV import requests", () => {
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
    const request = fetchMock(Response.json({ error: "Unknown template_slug \"bad\"" }, { status: 400 }));
    const result = await importFlowCsvRows([templateRow], request);
    expect(result).toEqual({
      imported: 0,
      failed: 1,
      errors: ['"Welcome Menu": Unknown template_slug "bad"'],
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
    expect(graph.nodes.find((node: { node_key: string }) => node.node_key === "welcome_msg").config).toMatchObject({
      text: row.initial_message,
      buttons: [
        { title: "Support", next_node_key: "action_1" },
        { title: "Sales", next_node_key: "action_2" },
      ],
    });
  });
});
