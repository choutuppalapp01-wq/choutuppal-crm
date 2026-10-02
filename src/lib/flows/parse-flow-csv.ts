/**
 * CSV parser and sample generator for Flows.
 *
 * Supports columns:
 * - name (required): Flow name
 * - trigger_type (required): 'keyword' | 'first_inbound_message' | 'manual'
 * - trigger_keywords (optional): Comma-separated trigger keywords (e.g. "hi,help,menu")
 * - initial_message (optional): Text greeting for the entry message
 * - button_options (optional): Semicolon-separated button titles (e.g. "Sales;Support;FAQ")
 * - template_slug (optional): Clones an existing Flow template graph (e.g. 'welcome_menu', 'faq_bot', 'lead_capture')
 * - description (optional): Brief summary of what this flow does
 */

import { getFlowTemplate } from "./templates";

export interface ParsedFlowRow {
  name: string;
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_keywords?: string[];
  initial_message?: string;
  button_options?: string[];
  template_slug?: string;
  description?: string;
  rawLineIndex: number;
}

export interface ParseFlowCsvResult {
  rows: ParsedFlowRow[];
  hasNameColumn: boolean;
  hasTriggerTypeColumn: boolean;
  errors: Array<{ line: number; message: string }>;
}

export const VALID_FLOW_TRIGGERS = ["keyword", "first_inbound_message", "manual"] as const;

export function parseFlowCsv(text: string): ParseFlowCsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine === -1) {
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
      errors: [{ line: firstContentLine + 1, message: "Unterminated quoted field; physical newlines inside CSV records are not supported." }],
    };
  }
  const headers = parseCsvLine(headerLine).map((header) =>
    header.trim().toLowerCase().replace(/["']/g, "")
  );

  const nameIdx = headers.indexOf("name");
  const triggerTypeIdx = headers.indexOf("trigger_type");
  const triggerKeywordsIdx = headers.indexOf("trigger_keywords");
  const initialMessageIdx = headers.indexOf("initial_message");
  const buttonOptionsIdx = headers.indexOf("button_options");
  const templateSlugIdx = headers.indexOf("template_slug");
  const descriptionIdx = headers.indexOf("description");
  const hasNameColumn = nameIdx !== -1;
  const hasTriggerTypeColumn = triggerTypeIdx !== -1;

  if (!hasNameColumn || !hasTriggerTypeColumn) {
    return {
      rows: [],
      hasNameColumn,
      hasTriggerTypeColumn,
      errors: [{
        line: firstContentLine + 1,
        message: `Missing required columns: ${[!hasNameColumn && "'name'", !hasTriggerTypeColumn && "'trigger_type'"].filter(Boolean).join(", ")}`,
      }],
    };
  }

  const rows: ParsedFlowRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  for (let i = firstContentLine + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    if (hasUnclosedQuotedField(rawLine)) {
      const startLine = i + 1;
      let quoteOpen = true;
      while (i + 1 < lines.length && quoteOpen) {
        i++;
        quoteOpen = quoteStateAfterLine(lines[i], quoteOpen);
      }
      errors.push({
        line: startLine,
        message: "Physical newlines inside quoted CSV records are not supported.",
      });
      continue;
    }

    const values = parseCsvLine(rawLine);
    const name = values[nameIdx]?.trim();
    const rawTrigger = values[triggerTypeIdx]?.trim().toLowerCase();

    if (!name) {
      errors.push({ line: i + 1, message: "Flow name is empty." });
      continue;
    }
    if (!rawTrigger || !VALID_FLOW_TRIGGERS.includes(rawTrigger as typeof VALID_FLOW_TRIGGERS[number])) {
      errors.push({ line: i + 1, message: `Invalid trigger_type "${rawTrigger}". Allowed: ${VALID_FLOW_TRIGGERS.join(", ")}` });
      continue;
    }

    const trigger_type = rawTrigger as typeof VALID_FLOW_TRIGGERS[number];
    const rawKeywords = values[triggerKeywordsIdx]?.trim() ?? "";
    const trigger_keywords = rawKeywords
      ? rawKeywords.split(",").map((keyword) => keyword.trim())
      : undefined;
    if (trigger_keywords?.some((keyword) => !keyword)) {
      errors.push({ line: i + 1, message: "trigger_keywords cannot contain empty entries." });
      continue;
    }
    const rawInitialMessage = values[initialMessageIdx];
    const initial_message = rawInitialMessage !== undefined && rawInitialMessage.length > 0
      ? rawInitialMessage
      : undefined;
    const rawButtons = values[buttonOptionsIdx]?.trim() ?? "";
    const button_options = rawButtons
      ? rawButtons.split(";").map((button) => button.trim())
      : undefined;
    if (button_options?.some((button) => !button)) {
      errors.push({ line: i + 1, message: "button_options cannot contain empty labels." });
      continue;
    }
    const template_slug = values[templateSlugIdx]?.trim() || undefined;
    const description = values[descriptionIdx]?.trim() || undefined;

    if (template_slug && !getFlowTemplate(template_slug)) {
      errors.push({ line: i + 1, message: `Unknown template_slug "${template_slug}".` });
      continue;
    }
    if (trigger_keywords && trigger_type !== "keyword") {
      errors.push({ line: i + 1, message: "trigger_keywords can only be used with keyword triggers." });
      continue;
    }
    if (button_options && button_options.length > 3) {
      errors.push({ line: i + 1, message: "button_options may contain at most 3 labels." });
      continue;
    }
    if (button_options?.some((button) => button.length > 20)) {
      errors.push({ line: i + 1, message: "Button labels must be no longer than 20 characters." });
      continue;
    }

    rows.push({
      name,
      trigger_type,
      trigger_keywords,
      initial_message,
      button_options,
      template_slug,
      description,
      rawLineIndex: i + 1,
    });
  }

  return { rows, hasNameColumn: true, hasTriggerTypeColumn: true, errors };
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

/** Parses one physical CSV line and retains field contents verbatim. */
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
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

/** Generates standard sample CSV content for flows */
export function getFlowSampleCsv(): string {
  return `name,trigger_type,trigger_keywords,initial_message,button_options,template_slug,description
"Welcome Menu & Routing",keyword,"hi,hello,menu,start","Welcome to our WhatsApp service! How can we assist you today?","Talk to Sales;Support Help;Book Demo",welcome_menu,"Multi-branch interactive greeting menu"
"Customer Feedback Bot",keyword,"feedback,review,rate","Thank you for your recent purchase! How was your experience with us?",,faq_bot,"Automated post-service survey flow"
"Lead Qualification Flow",keyword,"quote,pricing,buy","Hi there! To prepare a tailored quote, what best describes your needs?",,lead_capture,"Qualifies inbound leads and gathers requirements"
"First Contact Onboarding",first_inbound_message,"","Hello! Welcome to our channel. Choose an option to get started:","Explore Catalog;Track Order;Chat with Agent",,"Greets brand new incoming phone numbers with interactive buttons"
"VIP Agent Handoff Flow",manual,"","Connecting you directly with a dedicated VIP representative...",,,"Manual trigger flow used by agents inside inbox"`;
}
