import { describe, expect, it } from "vitest";
import { getFlowSampleCsv, parseFlowCsv } from "./parse-flow-csv";
import { getFlowTemplate } from "./templates";

describe("parseFlowCsv", () => {
  it("provides a sample CSV using only existing template slugs", () => {
    const result = parseFlowCsv(getFlowSampleCsv());

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(5);
    expect(result.rows.map((row) => row.template_slug).filter(Boolean)).toEqual([
      "welcome_menu",
      "faq_bot",
      "lead_capture",
    ]);
    expect(result.rows.some((row) => row.template_slug === "lead_qualifier")).toBe(false);
    expect(result.rows.every((row) => !row.template_slug || getFlowTemplate(row.template_slug))).toBe(true);
  });

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

  it("parses quoted commas and doubled quotes without changing field contents", () => {
    const result = parseFlowCsv([
      "name,trigger_type,initial_message,description",
      '"Sales, and Support",manual,"Say ""hello, team""", "Quoted, description"',
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      name: "Sales, and Support",
      initial_message: 'Say "hello, team"',
      description: "Quoted, description",
    });
  });

  it("preserves literal backslash-n and message whitespace exactly", () => {
    const message = "  నమస్కారం!\\nదయచేసి ఎంపిక చేయండి  ";
    const result = parseFlowCsv(`name,trigger_type,initial_message\nFlow,manual,"${message}"`);
    expect(result.rows[0]?.initial_message).toBe(message);
  });

  it("leaves optional fields undefined when their CSV cells are empty", () => {
    const result = parseFlowCsv([
      "name,trigger_type,trigger_keywords,initial_message,button_options,template_slug,description",
      "Blank fields,manual,,,,,",
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: "Blank fields", trigger_type: "manual" });
    expect(result.rows[0]).toMatchObject({
      trigger_keywords: undefined,
      initial_message: undefined,
      button_options: undefined,
      template_slug: undefined,
      description: undefined,
    });
  });

  it("retains duplicate rows as separate physical CSV records", () => {
    const result = parseFlowCsv([
      "name,trigger_type,trigger_keywords",
      "Repeated,keyword,hello",
      "Repeated,keyword,hello",
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.rawLineIndex)).toEqual([2, 3]);
    const contentRows = result.rows.map((row) => ({ ...row, rawLineIndex: 0 }));
    expect(contentRows[0]).toEqual(contentRows[1]);
  });

  it("records physical-line numbers after blank lines", () => {
    const result = parseFlowCsv([
      "name,trigger_type",
      "",
      "Broken,keyword,\"line one",
      "line two\",keyword,ignored",
      "Good,manual",
    ].join("\n"));

    expect(result.errors).toEqual([
      { line: 3, message: "Physical newlines inside quoted CSV records are not supported." },
    ]);
    expect(result.rows).toMatchObject([{ name: "Good", rawLineIndex: 5 }]);
  });

  it("rejects an unknown template_slug with a row-specific parser error", () => {
    const result = parseFlowCsv([
      "name,trigger_type,template_slug",
      "Unknown,keyword,missing-template",
    ].join("\n"));

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { line: 2, message: 'Unknown template_slug "missing-template".' },
    ]);
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
