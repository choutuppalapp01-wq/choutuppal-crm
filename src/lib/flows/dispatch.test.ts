import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Entry-trigger dispatch (issue #490).
//
// Drives the real `dispatchInboundToFlows` against a fake Supabase so
// the assertion is "a run was actually started", not "a helper returned
// true". The bug was that a button tap never reached the keyword
// matcher at all, so a helper-level test would have missed it.
// ============================================================

const h = vi.hoisted(() => ({
  state: {
    /** Rows loadActiveRunForContact sees. Empty = no run in progress. */
    activeRuns: [] as unknown[],
    flows: [] as unknown[],
    nodes: [] as unknown[],
    inserted: [] as { table: string; row: Record<string, unknown> }[],
    updated: [] as { table: string; patch: Record<string, unknown> }[],
    /** Set by the flow_runs INSERT; what its .maybeSingle() returns. */
    insertedRun: null as Record<string, unknown> | null,
    rpcCalls: [] as string[],
  },
}));

vi.mock("./admin-client", () => {
  function rows(table: string): unknown[] {
    if (table === "flow_runs") return h.state.activeRuns;
    if (table === "flows") return h.state.flows;
    if (table === "flow_nodes") return h.state.nodes;
    return [];
  }

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      filter: () => b,
      order: () => b,
      limit: () => b,
      update: (patch: Record<string, unknown>) => {
        h.state.updated.push({ table, patch });
        return b;
      },
      insert: (row: Record<string, unknown>) => {
        h.state.inserted.push({ table, row });
        if (table === "flow_runs") {
          h.state.insertedRun = {
            id: "run-1",
            vars: {},
            reprompt_count: 0,
            ...row,
          };
        }
        return b;
      },
      // Only reached on the INSERT ... SELECT for a new run, and on
      // loadFlow's flows lookup.
      maybeSingle: async () => ({
        data:
          table === "flow_runs" ? h.state.insertedRun : (rows(table)[0] ?? null),
        error: null,
      }),
      single: async () => ({ data: rows(table)[0] ?? null, error: null }),
      then: (
        resolve: (r: {
          data: unknown[];
          error: null;
          count: number;
        }) => unknown,
      ) => resolve({ data: rows(table), error: null, count: 0 }),
    };
    return b;
  }

  return {
    supabaseAdmin: () => ({
      from: (t: string) => builder(t),
      rpc: (name: string) => {
        h.state.rpcCalls.push(name);
        return Promise.resolve({ error: null });
      },
    }),
  };
});

const engineSendText = vi.fn(async () => ({ whatsapp_message_id: "wamid.1" }));
const engineSendContact = vi.fn(async () => ({ whatsapp_message_id: "wamid.CONTACT" }));
const engineSendMedia = vi.fn(async () => ({ whatsapp_message_id: "wamid.MEDIA" }));
const engineSendInteractiveButtons = vi.fn(async () => ({ whatsapp_message_id: "wamid.BUTTONS" }));

vi.mock("./meta-send", () => ({
  engineSendContact: (...a: unknown[]) =>
    (engineSendContact as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendMedia: (...a: unknown[]) =>
    (engineSendMedia as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveButtons: (...a: unknown[]) =>
    (engineSendInteractiveButtons as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveList: vi.fn(async () => ({ whatsapp_message_id: "wamid.LIST" })),
  engineSendText: (...a: unknown[]) =>
    (engineSendText as unknown as (...x: unknown[]) => unknown)(...a),
}));

import { dispatchInboundToFlows, entryTriggerTexts } from "./engine";
import type { ParsedInbound } from "./types";

const KEYWORD_FLOW = {
  id: "flow-1",
  account_id: "acct-1",
  user_id: "u-1",
  status: "active",
  trigger_type: "keyword",
  trigger_config: { keywords: ["order status"] },
  entry_node_id: "start",
  created_at: "2026-01-01T00:00:00Z",
};

const NODES = [
  {
    id: "n1",
    flow_id: "flow-1",
    node_key: "start",
    node_type: "start",
    config: { next_node_key: "greet" },
  },
  {
    id: "n2",
    flow_id: "flow-1",
    node_key: "greet",
    node_type: "send_message",
    config: { text: "Looking that up…", next_node_key: "done" },
  },
  {
    id: "n3",
    flow_id: "flow-1",
    node_key: "done",
    node_type: "end",
    config: {},
  },
];

function dispatch(message: ParsedInbound) {
  return dispatchInboundToFlows({
    accountId: "acct-1",
    userId: "u-1",
    contactId: "ct-1",
    conversationId: "cv-1",
    message,
    isFirstInboundMessage: false,
  });
}

/** flow_runs INSERTs made during a dispatch. */
function startedRuns() {
  return h.state.inserted.filter((i) => i.table === "flow_runs");
}

beforeEach(() => {
  // No run in progress — the whole point is the entry-trigger path.
  h.state.activeRuns = [];
  h.state.flows = [];
  h.state.nodes = NODES;
  h.state.inserted = [];
  h.state.updated = [];
  h.state.insertedRun = null;
  h.state.rpcCalls = [];
  engineSendText.mockClear();
  engineSendContact.mockClear();
  engineSendMedia.mockClear();
  engineSendInteractiveButtons.mockClear();
});

describe("entryTriggerTexts", () => {
  it("offers the typed text for a text message", () => {
    expect(
      entryTriggerTexts({
        kind: "text",
        text: "order status",
        meta_message_id: "m1",
      }),
    ).toEqual(["order status"]);
  });

  it("offers both the button title and its reply id", () => {
    expect(
      entryTriggerTexts({
        kind: "interactive_reply",
        reply_id: "btn_1",
        reply_title: "Order status",
        meta_message_id: "m1",
      }),
    ).toEqual(["Order status", "btn_1"]);
  });

  it("drops blanks and collapses a title identical to the id", () => {
    expect(
      entryTriggerTexts({
        kind: "interactive_reply",
        reply_id: "btn_1",
        reply_title: "btn_1",
        meta_message_id: "m1",
      }),
    ).toEqual(["btn_1"]);
    expect(
      entryTriggerTexts({
        kind: "interactive_reply",
        reply_id: "btn_1",
        reply_title: "   ",
        meta_message_id: "m1",
      }),
    ).toEqual(["btn_1"]);
  });
});

describe("dispatchInboundToFlows — entry triggers (#490)", () => {
  it("runs the persisted node snapshot without reloading a template by slug", async () => {
    const persistedGreeting = "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!";
    h.state.flows = [
      {
        ...KEYWORD_FLOW,
        template_slug: "welcome_menu",
        trigger_config: { keywords: ["custom greeting"] },
      },
    ];
    h.state.nodes = [
      { ...NODES[0], config: { next_node_key: "greet" } },
      {
        ...NODES[1],
        config: { text: persistedGreeting, next_node_key: "done" },
      },
      NODES[2],
    ];

    const result = await dispatch({
      kind: "text",
      text: "custom greeting",
      meta_message_id: "snapshot-1",
    });

    expect(result.consumed).toBe(true);
    expect(engineSendText).toHaveBeenCalledWith(expect.objectContaining({ text: persistedGreeting }));
    expect(engineSendText).toHaveBeenCalledTimes(1);
  });

  it("executes send_contact from persisted config and advances to the next node", async () => {
    const contactConfig = {
      contact_name: "Choutuppal App",
      contacts: [
        {
          name: "Choutuppal App",
          phones: [
            { phone: "9441348175", type: "CUSTOMER_CARE" },
            { phone: "9494348175", type: "WHATSAPP_BOT" },
          ],
        },
      ],
      next_node_key: "done",
    };
    h.state.flows = [KEYWORD_FLOW];
    h.state.nodes = [
      { ...NODES[0], config: { next_node_key: "send_contact" } },
      {
        id: "contact-node",
        flow_id: "flow-1",
        node_key: "send_contact",
        node_type: "send_contact",
        config: contactConfig,
      },
      NODES[2],
    ];

    const result = await dispatch({
      kind: "text",
      text: "order status",
      meta_message_id: "contact-send-1",
    });

    expect(result).toMatchObject({ consumed: true, outcome: "completed" });
    expect(engineSendContact).toHaveBeenCalledWith(
      expect.objectContaining({ contacts: contactConfig.contacts }),
    );
    const events = h.state.inserted
      .filter((item) => item.table === "flow_run_events")
      .map((item) => item.row);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "message_sent",
          node_key: "send_contact",
          payload: expect.objectContaining({ node_type: "send_contact", contact_count: 1 }),
        }),
        expect.objectContaining({ event_type: "node_entered", node_key: "done" }),
      ]),
    );
    expect(h.state.updated).toContainEqual(
      expect.objectContaining({ table: "flow_runs", patch: expect.objectContaining({ status: "completed" }) }),
    );
  });

  it("fails the run and records an error when Meta rejects send_contact", async () => {
    engineSendContact.mockRejectedValueOnce(new Error("Meta rejected contact"));
    h.state.flows = [KEYWORD_FLOW];
    h.state.nodes = [
      { ...NODES[0], config: { next_node_key: "send_contact" } },
      {
        id: "contact-node",
        flow_id: "flow-1",
        node_key: "send_contact",
        node_type: "send_contact",
        config: {
          contact_name: "Support",
          contacts: [{ name: "Support", phones: [{ phone: "5551234" }] }],
          next_node_key: "done",
        },
      },
      NODES[2],
    ];

    const result = await dispatch({
      kind: "text",
      text: "order status",
      meta_message_id: "contact-send-fail-1",
    });

    expect(result).toMatchObject({ consumed: true, outcome: "completed" });
    expect(h.state.inserted.map((item) => item.row)).toContainEqual(
      expect.objectContaining({
        event_type: "error",
        node_key: "send_contact",
        payload: expect.objectContaining({ reason: "send_contact_failed", detail: "Meta rejected contact" }),
      }),
    );
    expect(h.state.updated).toContainEqual(
      expect.objectContaining({ table: "flow_runs", patch: expect.objectContaining({ status: "failed", end_reason: "send_contact_failed" }) }),
    );
    expect(h.state.inserted.some((item) => item.row.event_type === "node_entered" && item.row.node_key === "done")).toBe(false);
  });

  it("keeps send_media auto-advance behavior intact", async () => {
    h.state.flows = [KEYWORD_FLOW];
    h.state.nodes = [
      { ...NODES[0], config: { next_node_key: "media" } },
      {
        id: "media-node",
        flow_id: "flow-1",
        node_key: "media",
        node_type: "send_media",
        config: { media_type: "image", media_url: "https://example.test/image.png", next_node_key: "done" },
      },
      NODES[2],
    ];

    const result = await dispatch({ kind: "text", text: "order status", meta_message_id: "media-regression-1" });

    expect(result.outcome).toBe("completed");
    expect(engineSendMedia).toHaveBeenCalledWith(expect.objectContaining({ kind: "image", link: "https://example.test/image.png" }));
    expect(h.state.inserted.map((item) => item.row)).toContainEqual(
      expect.objectContaining({ event_type: "message_sent", payload: expect.objectContaining({ node_type: "send_media" }) }),
    );
  });

  it("keeps send_buttons suspend behavior intact", async () => {
    h.state.flows = [KEYWORD_FLOW];
    h.state.nodes = [
      { ...NODES[0], config: { next_node_key: "buttons" } },
      {
        id: "buttons-node",
        flow_id: "flow-1",
        node_key: "buttons",
        node_type: "send_buttons",
        config: { text: "Choose", buttons: [{ reply_id: "yes", title: "Yes", next_node_key: "done" }] },
      },
      NODES[2],
    ];

    const result = await dispatch({ kind: "text", text: "order status", meta_message_id: "buttons-regression-1" });

    expect(result.outcome).toBe("started");
    expect(engineSendInteractiveButtons).toHaveBeenCalledWith(expect.objectContaining({ bodyText: "Choose" }));
    expect(h.state.inserted.map((item) => item.row)).toContainEqual(
      expect.objectContaining({ event_type: "message_sent", payload: expect.objectContaining({ node_type: "send_buttons" }) }),
    );
  });

  it("starts a keyword flow when the customer taps a matching button", async () => {
    h.state.flows = [KEYWORD_FLOW];

    const result = await dispatch({
      kind: "interactive_reply",
      reply_id: "btn_1",
      reply_title: "Order status",
      meta_message_id: "m1",
    });

    // Before the fix this returned {consumed: false, outcome: "no_match"}
    // — the tap was rejected before the keyword matcher ever ran.
    expect(result.consumed).toBe(true);
    expect(result.flow_run_id).toBe("run-1");
    expect(
      h.state.inserted.filter((i) => i.table === "flow_runs"),
    ).toHaveLength(1);
    expect(h.state.rpcCalls).toContain("increment_flow_execution_count");
    // The flow really ran, not just got created.
    expect(engineSendText).toHaveBeenCalledTimes(1);
  });

  it("matches on the reply id when the visible title does not", async () => {
    h.state.flows = [
      { ...KEYWORD_FLOW, trigger_config: { keywords: ["order_status"] } },
    ];

    const result = await dispatch({
      kind: "interactive_reply",
      reply_id: "order_status",
      reply_title: "Where is my parcel?",
      meta_message_id: "m1",
    });

    expect(result.consumed).toBe(true);
    expect(result.flow_run_id).toBe("run-1");
    expect(startedRuns()).toHaveLength(1);
  });

  it("still starts the same flow for the typed text (unchanged path)", async () => {
    h.state.flows = [KEYWORD_FLOW];

    const result = await dispatch({
      kind: "text",
      text: "order status please",
      meta_message_id: "m1",
    });

    expect(result.consumed).toBe(true);
    expect(result.flow_run_id).toBe("run-1");
    expect(startedRuns()).toHaveLength(1);
  });

  it("leaves a non-matching tap for the automations dispatcher", async () => {
    h.state.flows = [KEYWORD_FLOW];

    const result = await dispatch({
      kind: "interactive_reply",
      reply_id: "btn_9",
      reply_title: "Talk to a human",
      meta_message_id: "m1",
    });

    // consumed:false is what lets the webhook fire the
    // `interactive_reply` automation trigger instead.
    expect(result.consumed).toBe(false);
    expect(result.outcome).toBe("no_match");
    expect(h.state.inserted.filter((i) => i.table === "flow_runs")).toEqual([]);
  });

  it("does not start a manual-trigger flow from a tap", async () => {
    h.state.flows = [{ ...KEYWORD_FLOW, trigger_type: "manual" }];

    const result = await dispatch({
      kind: "interactive_reply",
      reply_id: "btn_1",
      reply_title: "Order status",
      meta_message_id: "m1",
    });

    expect(result.consumed).toBe(false);
  });

  it("starts a first_inbound_message flow when the first inbound is a tap", async () => {
    h.state.flows = [
      {
        ...KEYWORD_FLOW,
        trigger_type: "first_inbound_message",
        trigger_config: {},
      },
    ];

    const result = await dispatchInboundToFlows({
      accountId: "acct-1",
      userId: "u-1",
      contactId: "ct-1",
      conversationId: "cv-1",
      message: {
        kind: "interactive_reply",
        reply_id: "btn_1",
        reply_title: "Yes, tell me more",
        meta_message_id: "m1",
      },
      isFirstInboundMessage: true,
    });

    // A broadcast template's quick-reply button can genuinely be a
    // contact's first-ever inbound; the automations side already
    // treated it that way.
    expect(result.consumed).toBe(true);
    expect(result.flow_run_id).toBe("run-1");
    expect(startedRuns()).toHaveLength(1);
  });

  it("routes inbound message with valid website context to targeted active flow", async () => {
    process.env.FEATURE_WEBSITE_CONTEXT = "true";
    const REAL_ESTATE_FLOW = {
      ...KEYWORD_FLOW,
      id: "flow-real-estate",
      name: "Choutuppal Real Estate Inquiries",
      description: "real_estate flow template",
      trigger_type: "keyword",
      trigger_config: { keywords: ["plots", "villas"] },
    };
    h.state.flows = [KEYWORD_FLOW, REAL_ESTATE_FLOW];

    const result = await dispatchInboundToFlows({
      accountId: "acct-1",
      userId: "u-1",
      contactId: "ct-1",
      conversationId: "cv-1",
      message: {
        kind: "text",
        text: "Hi, I am interested in this property\n\n[CTX source=website service=real_estate intent=property_enquiry property_id=prop-123]",
        meta_message_id: "m-web-1",
      },
      isFirstInboundMessage: false,
    });

    delete process.env.FEATURE_WEBSITE_CONTEXT;
    expect(result.consumed).toBe(true);
    expect(result.flow_run_id).toBe("run-1");
    // Verifies it started the real estate flow and stored website_context
    expect(startedRuns().map((i) => i.row)).toEqual([
      expect.objectContaining({
        flow_id: "flow-real-estate",
        vars: expect.objectContaining({
          website_context: expect.objectContaining({
            source: "website",
            service: "real_estate",
            property_id: "prop-123",
          }),
        }),
      }),
    ]);
  });

  it("does not hijack an active flow when inbound message contains website context", async () => {
    process.env.FEATURE_WEBSITE_CONTEXT = "true";
    // Setup an existing active run for this contact
    h.state.activeRuns = [
      {
        id: "active-run-99",
        flow_id: "flow-1",
        account_id: "acct-1",
        contact_id: "ct-1",
        conversation_id: "cv-1",
        status: "active",
        current_node_key: "prompt",
        vars: {},
        reprompt_count: 0,
      },
    ];
    h.state.nodes = [
      {
        id: "prompt-node",
        flow_id: "flow-1",
        node_key: "prompt",
        node_type: "collect_input",
        config: {
          prompt_text: "What is your name?",
          var_key: "name",
          next_node_key: "done",
        },
      },
      NODES[2],
    ];

    const result = await dispatchInboundToFlows({
      accountId: "acct-1",
      userId: "u-1",
      contactId: "ct-1",
      conversationId: "cv-1",
      message: {
        kind: "text",
        text: "My name is Ram [CTX source=website service=real_estate]",
        meta_message_id: "m-active-1",
      },
      isFirstInboundMessage: false,
    });

    delete process.env.FEATURE_WEBSITE_CONTEXT;
    expect(result.consumed).toBe(true);
    // Active run was advanced, NOT restarted or hijacked into real estate flow
    expect(result.flow_run_id).toBe("active-run-99");
    expect(startedRuns()).toHaveLength(0);
  });
});
