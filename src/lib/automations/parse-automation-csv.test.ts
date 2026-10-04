import { describe, expect, it } from "vitest";
import {
  getAutomationSampleCsv,
  parseAutomationCsv,
} from "./parse-automation-csv";

describe("parseAutomationCsv", () => {
  it("parses valid send_message action and escaped newlines", () => {
    const csv = `name,trigger_type,trigger_value,action_type,action_value,is_active,description
"Welcome Bot",first_inbound_message,"",send_message,"Line 1\\nLine 2",true,"First greeting"`;

    const result = parseAutomationCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Welcome Bot",
      trigger_type: "first_inbound_message",
      action_type: "send_message",
      action_value: "Line 1\\nLine 2",
      is_active: true,
      description: "First greeting",
    });
  });

  it("parses valid add_tag action with clean tag identifier", () => {
    const csv = `name,trigger_type,trigger_value,action_type,action_value,is_active
"VIP Tagging",keyword_match,"vip,contract",add_tag,"VIP_Customer_2026",true`;

    const result = parseAutomationCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "VIP Tagging",
      trigger_type: "keyword_match",
      trigger_value: "vip,contract",
      action_type: "add_tag",
      action_value: "VIP_Customer_2026",
      is_active: true,
    });
  });

  it("rejects unsupported action types for safe import", () => {
    const csv = `name,trigger_type,action_type,action_value
"Unsafe Action",keyword_match,send_webhook,"https://evil.com/hook"
"Another Action",keyword_match,close_conversation,""`;

    const result = parseAutomationCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('Unsupported action_type "send_webhook"');
    expect(result.errors[1].message).toContain('Unsupported action_type "close_conversation"');
  });

  it("rejects invalid tags with spaces or special characters", () => {
    const csv = `name,trigger_type,trigger_value,action_type,action_value
"Bad Tag 1",keyword_match,"",add_tag,"VIP Customer"
"Bad Tag 2",keyword_match,"",add_tag,"tag@alert!"
"Bad Trigger Tag",tag_added,"tag with space",send_message,"Hello"`;

    const result = parseAutomationCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].message).toContain("Invalid tag identifier");
    expect(result.errors[1].message).toContain("Invalid tag identifier");
    expect(result.errors[2].message).toContain("Invalid trigger tag identifier");
  });

  it("rejects invalid trigger tag when trigger_type is tag_added", () => {
    const csv = `name,trigger_type,trigger_value,action_type,action_value
"Tag Added With Spaces",tag_added,"My Space Tag",send_message,"Welcome"`;

    const result = parseAutomationCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid trigger tag identifier "My Space Tag"');
  });

  it("rejects malformed CSV missing required columns or empty file", () => {
    const emptyResult = parseAutomationCsv("");
    expect(emptyResult.errors[0].message).toContain("File is empty");

    const missingResult = parseAutomationCsv("title,some_col\nvalue1,value2");
    expect(missingResult.hasNameColumn).toBe(false);
    expect(missingResult.errors[0].message).toContain("Missing required columns");
  });

  it("rejects physical unclosed newlines inside quoted fields", () => {
    const physicalNewlineCsv = `name,trigger_type,action_type,action_value
"Multiline Name
broken line",first_inbound_message,send_message,"text"`;

    const result = parseAutomationCsv(physicalNewlineCsv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].message).toContain("physical newlines inside CSV records are not supported");
  });

  it("parses multiple valid rows correctly from sample CSV", () => {
    const sample = getAutomationSampleCsv();
    const result = parseAutomationCsv(sample);
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    for (const row of result.rows) {
      if (row.action_type) {
        expect(["send_message", "add_tag"]).toContain(row.action_type);
      }
    }
  });
});
