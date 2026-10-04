/**
 * CSV parser and sample generator for Automations.
 *
 * Supports columns:
 * - name (required): Name of the automation
 * - trigger_type (required): 'new_message_received' | 'first_inbound_message' | 'keyword_match' | 'interactive_reply' | 'new_contact_created' | 'conversation_assigned' | 'tag_added' | 'time_based'
 * - trigger_value (optional): keyword(s) for keyword_match, tag name or id for tag_added, reply_ids for interactive_reply, schedule/time for time_based
 * - action_type (optional): first step action — restricted to 'send_message' and 'add_tag' for safe CSV import
 * - action_value (optional): message text, clean tag identifier
 * - is_active (optional): 'true' | 'false' (defaults to false for draft safety)
 * - description (optional): Brief summary
 * - template_slug (optional): pre-built template to populate full steps ('welcome_message', 'out_of_office', 'lead_qualifier', 'follow_up_reminder')
 */

import type { AutomationTriggerType, AutomationStepType } from "@/types";

export interface ParsedAutomationRow {
  name: string;
  trigger_type: AutomationTriggerType;
  trigger_value?: string;
  action_type?: AutomationStepType;
  action_value?: string;
  is_active: boolean;
  description?: string;
  template_slug?: string;
  rawLineIndex: number;
}

export interface ParseAutomationCsvResult {
  rows: ParsedAutomationRow[];
  hasNameColumn: boolean;
  hasTriggerTypeColumn: boolean;
  errors: Array<{ line: number; message: string }>;
}

export const VALID_AUTOMATION_TRIGGERS: AutomationTriggerType[] = [
  "new_message_received",
  "first_inbound_message",
  "keyword_match",
  "interactive_reply",
  "new_contact_created",
  "conversation_assigned",
  "tag_added",
  "time_based",
];

export const ALLOWED_AUTOMATION_IMPORT_ACTIONS = [
  "send_message",
  "add_tag",
] as const;

export type AllowedAutomationImportAction =
  (typeof ALLOWED_AUTOMATION_IMPORT_ACTIONS)[number];

export const VALID_AUTOMATION_ACTIONS: readonly AutomationStepType[] =
  ALLOWED_AUTOMATION_IMPORT_ACTIONS;

export const VALID_TAG_IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;

export function parseAutomationCsv(text: string): ParseAutomationCsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine === -1 || lines.length < 2) {
    return {
      rows: [],
      hasNameColumn: false,
      hasTriggerTypeColumn: false,
      errors: [{ line: 1, message: "File is empty or missing data rows." }],
    };
  }

  const headerLine = lines[firstContentLine];
  if (hasUnclosedQuotedField(headerLine)) {
    return {
      rows: [],
      hasNameColumn: false,
      hasTriggerTypeColumn: false,
      errors: [
        {
          line: firstContentLine + 1,
          message:
            "Unterminated quoted field; physical newlines inside CSV records are not supported.",
        },
      ],
    };
  }

  const headers = parseCsvLine(headerLine).map((h) =>
    h.trim().toLowerCase().replace(/["']/g, "")
  );

  const nameIdx = headers.indexOf("name");
  const triggerTypeIdx = headers.indexOf("trigger_type");
  const triggerValueIdx = headers.indexOf("trigger_value");
  const actionTypeIdx = headers.indexOf("action_type");
  const actionValueIdx = headers.indexOf("action_value");
  const isActiveIdx = headers.indexOf("is_active");
  const descriptionIdx = headers.indexOf("description");
  const templateSlugIdx = headers.indexOf("template_slug");

  const hasNameColumn = nameIdx !== -1;
  const hasTriggerTypeColumn = triggerTypeIdx !== -1;

  if (!hasNameColumn || !hasTriggerTypeColumn) {
    return {
      rows: [],
      hasNameColumn,
      hasTriggerTypeColumn,
      errors: [
        {
          line: firstContentLine + 1,
          message: `Missing required columns: ${[!hasNameColumn && "'name'", !hasTriggerTypeColumn && "'trigger_type'"].filter(Boolean).join(", ")}`,
        },
      ],
    };
  }

  const rows: ParsedAutomationRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  for (let i = firstContentLine + 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (hasUnclosedQuotedField(rawLine)) {
      errors.push({
        line: i + 1,
        message:
          "Unterminated quoted field; physical newlines inside CSV records are not supported.",
      });
      continue;
    }

    const values = parseCsvLine(rawLine);
    const name = values[nameIdx]?.replace(/^["']|["']$/g, "").trim();
    const rawTrigger = values[triggerTypeIdx]?.replace(/^["']|["']$/g, "").trim().toLowerCase();

    if (!name) {
      errors.push({ line: i + 1, message: "Name is empty." });
      continue;
    }

    if (!rawTrigger || !VALID_AUTOMATION_TRIGGERS.includes(rawTrigger as AutomationTriggerType)) {
      errors.push({
        line: i + 1,
        message: `Invalid trigger_type "${rawTrigger}". Allowed: ${VALID_AUTOMATION_TRIGGERS.join(", ")}`,
      });
      continue;
    }

    const trigger_type = rawTrigger as AutomationTriggerType;
    const trigger_value = triggerValueIdx >= 0 ? values[triggerValueIdx]?.replace(/^["']|["']$/g, "").trim() : undefined;
    const rawAction = actionTypeIdx >= 0 ? values[actionTypeIdx]?.replace(/^["']|["']$/g, "").trim().toLowerCase() : undefined;
    const action_value = actionValueIdx >= 0 ? values[actionValueIdx]?.replace(/^["']|["']$/g, "").trim() : undefined;
    const rawActive = isActiveIdx >= 0 ? values[isActiveIdx]?.replace(/^["']|["']$/g, "").trim().toLowerCase() : "false";
    const description = descriptionIdx >= 0 ? values[descriptionIdx]?.replace(/^["']|["']$/g, "").trim() : undefined;
    const template_slug = templateSlugIdx >= 0 ? values[templateSlugIdx]?.replace(/^["']|["']$/g, "").trim() : undefined;

    // Validate tag trigger if trigger_type === 'tag_added'
    if (trigger_type === "tag_added" && trigger_value) {
      if (!VALID_TAG_IDENTIFIER_REGEX.test(trigger_value)) {
        errors.push({
          line: i + 1,
          message: `Invalid trigger tag identifier "${trigger_value}". Tags must match /^[A-Za-z0-9_]+$/ without spaces or special characters.`,
        });
        continue;
      }
    }

    let action_type: AutomationStepType | undefined = undefined;
    if (rawAction) {
      if (!ALLOWED_AUTOMATION_IMPORT_ACTIONS.includes(rawAction as AllowedAutomationImportAction)) {
        errors.push({
          line: i + 1,
          message: `Unsupported action_type "${rawAction}". Allowed actions for CSV import are: ${ALLOWED_AUTOMATION_IMPORT_ACTIONS.join(", ")}.`,
        });
        continue;
      }
      action_type = rawAction as AutomationStepType;

      if (action_type === "add_tag") {
        if (!action_value || !VALID_TAG_IDENTIFIER_REGEX.test(action_value)) {
          errors.push({
            line: i + 1,
            message: `Invalid tag identifier "${action_value ?? ""}". Tags must match /^[A-Za-z0-9_]+$/ without spaces or special characters.`,
          });
          continue;
        }
      }
    }

    rows.push({
      name,
      trigger_type,
      trigger_value,
      action_type,
      action_value,
      is_active: rawActive === "true" || rawActive === "1" || rawActive === "yes",
      description,
      template_slug,
      rawLineIndex: i + 1,
    });
  }

  return {
    rows,
    hasNameColumn: true,
    hasTriggerTypeColumn: true,
    errors,
  };
}

function hasUnclosedQuotedField(line: string): boolean {
  return quoteStateAfterLine(line, false);
}

function quoteStateAfterLine(line: string, initialState: boolean): boolean {
  let inQuotes = initialState;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '"') continue;
    if (inQuotes && line[i + 1] === '"') {
      i++;
    } else {
      inQuotes = !inQuotes;
    }
  }
  return inQuotes;
}

/** Parses CSV line taking quotation marks and commas into account */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/** Generates standard sample CSV content for automations */
export function getAutomationSampleCsv(): string {
  return `name,trigger_type,trigger_value,action_type,action_value,is_active,description,template_slug
"Instant Welcome Reply",first_inbound_message,"",send_message,"Hello! Thanks for reaching out to us on WhatsApp. How can we help you today?",false,"Auto-reply to first-time WhatsApp inquiries",welcome_message
"Pricing Inquiry Auto-Reply",keyword_match,"pricing,quote,cost",send_message,"Here is our pricing: Starter $29/mo, Pro $79/mo. Would you like a demo?",false,"Answers pricing keywords instantly",
"VIP Lead Tagging",keyword_match,"enterprise,vip,contract",add_tag,"VIP_Lead",false,"Tag hot leads when mentioned in conversation",
"After Hours Auto-Responder",time_based,"18:00-09:00",send_message,"Our office is currently closed (hours 9am-6pm). We will respond first thing tomorrow morning!",false,"Out of office auto response",out_of_office`;
}
