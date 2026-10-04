import type { ParsedFlowRow } from "./parse-flow-csv";
import { validateFlowForActivation } from "./validate";
import { buildTemplateWithOverrides } from "./templates";

type Fetcher = typeof fetch;

export interface FlowImportIssue {
  code: string;
  message: string;
  field?: string;
  severity: "error" | "warning";
}

export interface FlowImportResult {
  imported: number;
  failed: number;
  errors: string[];
  issues?: FlowImportIssue[];
}

export interface FlowImportPreviewItem {
  row: number;
  name: string;
  trigger_type: string;
  trigger_keywords?: string[];
  template_slug?: string;
  node_count: number;
  edge_count: number;
  valid: boolean;
  issues: FlowImportIssue[];
}

/**
 * Previews flow graph construction and validation for CSV rows without making any network or database mutations.
 */
export function previewFlowCsvRows(rows: ParsedFlowRow[]): FlowImportPreviewItem[] {
  return rows.map((row) => {
    try {
      const graph = buildFlowGraphFromRow(row);
      const issues = validateFlowForActivation(
        {
          name: row.name,
          trigger_type: row.trigger_type,
          trigger_config: graph.trigger_config,
          entry_node_id: graph.entry_node_id,
        },
        graph.nodes,
      );

      const mappedIssues: FlowImportIssue[] = issues.map((i) => ({
        code: i.severity === "error" ? "INVALID_GRAPH" : "GRAPH_WARNING",
        message: i.message,
        field: i.field,
        severity: i.severity,
      }));

      // Count edges inside node configs
      let edgeCount = 0;
      for (const node of graph.nodes) {
        const config = node.config as Record<string, unknown>;
        if (typeof config.next_node_key === "string") edgeCount++;
        if (typeof config.true_next === "string") edgeCount++;
        if (typeof config.false_next === "string") edgeCount++;
        if (Array.isArray(config.buttons)) {
          for (const btn of config.buttons) {
            if (typeof (btn as { next_node_key?: unknown }).next_node_key === "string") {
              edgeCount++;
            }
          }
        }
        if (Array.isArray(config.sections)) {
          for (const sec of config.sections) {
            if (Array.isArray((sec as { rows?: unknown[] }).rows)) {
              for (const r of (sec as { rows: unknown[] }).rows) {
                if (typeof (r as { next_node_key?: unknown }).next_node_key === "string") {
                  edgeCount++;
                }
              }
            }
          }
        }
      }

      return {
        row: row.rawLineIndex,
        name: row.name,
        trigger_type: row.trigger_type,
        trigger_keywords: row.trigger_keywords,
        template_slug: row.template_slug,
        node_count: graph.nodes.length,
        edge_count: edgeCount,
        valid: mappedIssues.every((i) => i.severity !== "error"),
        issues: mappedIssues,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Graph generation failed";
      return {
        row: row.rawLineIndex,
        name: row.name,
        trigger_type: row.trigger_type,
        trigger_keywords: row.trigger_keywords,
        template_slug: row.template_slug,
        node_count: 0,
        edge_count: 0,
        valid: false,
        issues: [{ code: "BUILD_ERROR", message, severity: "error" }],
      };
    }
  });
}

/**
 * Builds and validates the complete flow graph representation from a parsed CSV row.
 * Throws an Error if template resolution fails or the graph cannot be constructed.
 */
export function buildFlowGraphFromRow(row: ParsedFlowRow): {
  name: string;
  description: string | null;
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: Record<string, unknown>;
  entry_node_id: string;
  nodes: ImportFlowNode[];
} {
  const triggerConfig: Record<string, unknown> =
    row.trigger_type === "keyword"
      ? {
          keywords: row.trigger_keywords !== undefined ? row.trigger_keywords : ["hi", "hello"],
          match_type: "contains",
        }
      : {};

  if (row.template_slug) {
    const template = buildTemplateWithOverrides(row.template_slug, {
      name: row.name,
      description: row.description,
      trigger_type: row.trigger_type,
      trigger_keywords: row.trigger_keywords,
      initial_message: row.initial_message,
      button_options: row.button_options,
    });
    if (!template) {
      throw new Error(`Unknown template_slug "${row.template_slug}"`);
    }

    const nodes: ImportFlowNode[] = template.nodes.map((n, idx) => ({
      node_key: n.node_key,
      node_type: n.node_type,
      config: n.config as Record<string, unknown>,
      position_x: 100 + (idx % 3) * 240,
      position_y: 100 + Math.floor(idx / 3) * 140,
    }));

    return {
      name: template.name,
      description: template.description ?? null,
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config as Record<string, unknown>,
      entry_node_id: template.entry_node_id,
      nodes,
    };
  }

  const nodes = buildImportFlowNodes(row);
  return {
    name: row.name.trim(),
    description: row.description ?? null,
    trigger_type: row.trigger_type,
    trigger_config: triggerConfig,
    entry_node_id: "start",
    nodes,
  };
}

export async function importFlowCsvRows(
  rows: ParsedFlowRow[],
  request: Fetcher = fetch,
): Promise<FlowImportResult> {
  const result: FlowImportResult = { imported: 0, failed: 0, errors: [] };

  for (const row of rows) {
    try {
      await importFlowCsvRow(row, request);
      result.imported++;
    } catch (error) {
      result.failed++;
      const message = error instanceof Error ? error.message : "Creation failed";
      result.errors.push(`"${row.name}": ${message}`);
    }
  }

  return result;
}

export async function importFlowCsvRow(
  row: ParsedFlowRow,
  request: Fetcher = fetch,
): Promise<void> {
  // Pre-validate the graph before issuing network requests
  const graph = buildFlowGraphFromRow(row);
  const issues = validateFlowForActivation(
    {
      name: graph.name,
      trigger_type: graph.trigger_type,
      trigger_config: graph.trigger_config,
      entry_node_id: graph.entry_node_id,
    },
    graph.nodes,
  );

  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Graph validation failed: ${errors.map((e) => e.message).join("; ")}`);
  }

  const payload: Record<string, unknown> = {
    name: graph.name,
    description: graph.description,
    trigger_type: graph.trigger_type,
    trigger_keywords: row.trigger_keywords ?? null,
    initial_message: row.initial_message ?? null,
    button_options: row.button_options ?? null,
  };

  if (row.template_slug) {
    payload.template_slug = row.template_slug;
  } else {
    payload.trigger_config = graph.trigger_config;
  }

  const response = await request("/api/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await responseError(response);

  const result = (await response.json()) as { flow?: { id?: string } };
  const flowId = result?.flow?.id;
  if (!flowId) throw new Error("Flow API response did not include a flow id.");

  // If it was a template import, POST /api/flows already clones the template nodes
  if (row.template_slug) return;

  // For non-template custom flows, save the validated node graph
  const updateResponse = await request(`/api/flows/${flowId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entry_node_id: graph.entry_node_id, nodes: graph.nodes }),
  });
  if (!updateResponse.ok) throw await responseError(updateResponse);
}

export interface ImportFlowNode {
  node_key: string;
  node_type: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export function buildImportFlowNodes(row: ParsedFlowRow): ImportFlowNode[] {
  const nodes: ImportFlowNode[] = [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome_msg" },
      position_x: 100,
      position_y: 100,
    },
  ];

  if (row.button_options?.length) {
    const buttons = row.button_options.map((title, index) => ({
      reply_id: `btn_${index + 1}`,
      title,
      next_node_key: `action_${index + 1}`,
    }));
    nodes.push({
      node_key: "welcome_msg",
      node_type: "send_buttons",
      config: {
        text: row.initial_message ?? "Welcome! Please select an option below:",
        buttons,
      },
      position_x: 100,
      position_y: 220,
    });
    buttons.forEach((button, index) => {
      nodes.push({
        node_key: button.next_node_key,
        node_type: "send_message",
        config: {
          text: `You selected "${button.title}". An agent will be in touch shortly!`,
          next_node_key: "end",
        },
        position_x: 240 * (index + 1),
        position_y: 380,
      });
    });
    nodes.push({
      node_key: "end",
      node_type: "end",
      config: {},
      position_x: Math.round(240 * ((buttons.length + 1) / 2)),
      position_y: 520,
    });
  } else {
    nodes.push({
      node_key: "welcome_msg",
      node_type: "send_message",
      config: {
        text: row.initial_message ?? "Hello! Thank you for reaching out.",
        next_node_key: "end",
      },
      position_x: 100,
      position_y: 220,
    });
    nodes.push({
      node_key: "end",
      node_type: "end",
      config: {},
      position_x: 100,
      position_y: 380,
    });
  }

  return nodes;
}

async function responseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const message =
    typeof body?.error === "string" && body.error ? body.error : `HTTP ${response.status}`;
  return new Error(message);
}

export type { ParsedFlowRow };
