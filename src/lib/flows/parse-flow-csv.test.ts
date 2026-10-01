import { describe, expect, it } from "vitest";
import { parseFlowCsv } from "./parse-flow-csv";

describe("parseFlowCsv", () => {
  it("preserves Telugu template overrides and parses mixed-language keywords", () => {
    const csv = [
      "name,description,trigger_type,trigger_keywords,initial_message,button_options,template_slug",
      '"Welcome Menu","Telugu greeting",keyword,"Hi,hi,Hello,నమస్కారం,హాయ్","నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!","సేవలు;వ్యాపారాలు;సహాయం",welcome_menu',
    ].join("\n");

    const result = parseFlowCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Welcome Menu",
      description: "Telugu greeting",
      trigger_type: "keyword",
      trigger_keywords: ["Hi", "hi", "Hello", "నమస్కారం", "హాయ్"],
      initial_message: "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!",
      button_options: ["సేవలు", "వ్యాపారాలు", "సహాయం"],
      template_slug: "welcome_menu",
    });
  });

  it("preserves literal backslash-n and message whitespace exactly", () => {
    const message = "  నమస్కారం!\\nదయచేసి ఎంపిక చేయండి  ";
    const result = parseFlowCsv(`name,trigger_type,initial_message\nFlow,manual,"${message}"`);
    expect(result.rows[0]?.initial_message).toBe(message);
  });

  it("rejects unknown templates, excess buttons, and long labels by row", () => {
    const result = parseFlowCsv([
      "name,trigger_type,button_options,template_slug",
      "Unknown,keyword,,not-a-template",
      "Too many,keyword,One;Two;Three;Four,welcome_menu",
      `Too long,keyword,${"x".repeat(21)},welcome_menu`,
    ].join("\n"));
    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].message).toContain("Unknown template_slug");
    expect(result.errors[1].message).toContain("at most 3");
    expect(result.errors[2].message).toContain("20 characters");
  });

  it("rejects physical newlines inside quoted records", () => {
    const result = parseFlowCsv([
      "name,trigger_type,initial_message",
      'Broken,keyword,"line one',
      'line two",keyword,ignored',
      "Good,manual,hello",
    ].join("\n"));
    expect(result.rows.map((row) => row.name)).toEqual(["Good"]);
    expect(result.errors).toEqual([
      { line: 2, message: "Physical newlines inside quoted CSV records are not supported." },
    ]);
  });
});
