import type { ParsedFlowRow } from "./parse-flow-csv";

type Fetcher = typeof fetch;

export interface FlowImportResult {
  imported: number;
  failed: number;
  errors: string[];
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
  const triggerConfig = row.trigger_type === "keyword"
    ? { keywords: row.trigger_keywords?.length ? row.trigger_keywords : ["hi", "hello"], match_type: "contains" }
    : {};
  const payload: Record<string, unknown> = {
    name: row.name,
    description: row.description ?? null,
    trigger_type: row.trigger_type,
    trigger_keywords: row.trigger_keywords ?? null,
    initial_message: row.initial_message ?? null,
    button_options: row.button_options ?? null,
  };

  if (row.template_slug) {
    payload.template_slug = row.template_slug;
  } else {
    payload.trigger_config = triggerConfig;
  }

  const response = await request("/api/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await responseError(response);

  const result = await response.json() as { flow?: { id?: string } };
  const flowId = result?.flow?.id;
  if (!flowId) throw new Error("Flow API response did not include a flow id.");

  if (row.template_slug || (!row.initial_message && !row.button_options?.length)) return;

  const nodes: Array<Record<string, unknown>> = [{
    node_key: "start",
    node_type: "start",
    config: { next_node_key: "welcome_msg" },
    position_x: 100,
    position_y: 100,
  }];

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
          next_node_key: "",
        },
        position_x: 240 * (index + 1),
        position_y: 380,
      });
    });
  } else {
    nodes.push({
      node_key: "welcome_msg",
      node_type: "send_message",
      config: {
        text: row.initial_message ?? "Hello! Thank you for reaching out.",
        next_node_key: "",
      },
      position_x: 100,
      position_y: 220,
    });
  }

  const updateResponse = await request(`/api/flows/${flowId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entry_node_id: "start", nodes }),
  });
  if (!updateResponse.ok) throw await responseError(updateResponse);
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  const message = typeof body?.error === "string" && body.error
    ? body.error
    : `HTTP ${response.status}`;
  return new Error(message);
}

export type { ParsedFlowRow };
