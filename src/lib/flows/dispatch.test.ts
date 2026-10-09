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
    categories: [] as unknown[],
    listings: [] as unknown[],
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
    if (table === "categories") return h.state.categories;
    if (table === "business_listings") return h.state.listings;
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
const engineSendInteractiveList = vi.fn(async () => ({ whatsapp_message_id: "wamid.LIST" }));
const engineSendInteractiveCtaUrl = vi.fn(async () => ({ whatsapp_message_id: "wamid.CTA_URL" }));

vi.mock("./meta-send", () => ({
  engineSendContact: (...a: unknown[]) =>
    (engineSendContact as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendMedia: (...a: unknown[]) =>
    (engineSendMedia as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveButtons: (...a: unknown[]) =>
    (engineSendInteractiveButtons as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveCtaUrl: (...a: unknown[]) =>
    (engineSendInteractiveCtaUrl as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendInteractiveList: (...a: unknown[]) =>
    (engineSendInteractiveList as unknown as (...x: unknown[]) => unknown)(...a),
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
  h.state.categories = [];
  h.state.listings = [];
  h.state.inserted = [];
  h.state.updated = [];
  h.state.insertedRun = null;
  h.state.rpcCalls = [];
  engineSendText.mockClear();
  engineSendContact.mockClear();
  engineSendMedia.mockClear();
  engineSendInteractiveButtons.mockClear();
  engineSendInteractiveList.mockClear();
  engineSendInteractiveCtaUrl.mockClear();
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

  describe("Dynamic Directory Navigation — handleReplyForActiveRun Regression Tests (Phase 2F)", () => {
    const sampleCategories = [
      {
        id: "cat-1",
        slug: "automobile",
        name_en: "Automobile",
        name_te: "ఆటోమొబైల్",
        display_order: 1,
        account_id: "acct-1",
        is_active: true,
      },
      {
        id: "cat-2",
        slug: "services",
        name_en: "Services",
        name_te: "సర్వీసెస్",
        display_order: 2,
        account_id: "acct-1",
        is_active: true,
      },
    ];

    const sampleListings = [
      {
        id: "biz-1",
        name: "S.S. Auto Electrical Works",
        category_slug: "automobile",
        phone: "9885374861",
        whatsapp_phone: "9885374861",
        status: "published",
        account_id: "acct-1",
        is_verified: true,
        is_premium: false,
        metadata: { listing_id: "CPL-BIZ-001" },
      },
    ];

    it("1. route_business + opt_browse_directory triggers directory category list instead of repeating route_business", async () => {
      h.state.categories = sampleCategories;
      h.state.activeRuns = [
        {
          id: "active-run-route-biz",
          flow_id: "flow-welcome",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "route_business",
          vars: {},
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-route-biz",
          flow_id: "flow-welcome",
          node_key: "route_business",
          node_type: "send_list",
          config: {
            text: "🏪 *చౌటుప్పల్ వ్యాపార సేవలు*",
            button_label: "సేవలు చూడండి",
            sections: [
              {
                title: "వ్యాపార సేవలు",
                rows: [
                  {
                    reply_id: "opt_business_listing",
                    title: "📇 Business Listing",
                    next_node_key: "resp_business_listing",
                  },
                  {
                    reply_id: "opt_browse_directory",
                    title: "🔎 Browse Businesses",
                    next_node_key: "route_business", // In flow_nodes this pointed to itself!
                  },
                ],
              },
            ],
          },
        },
      ];

      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "opt_browse_directory",
        reply_title: "🔎 Browse Businesses",
        meta_message_id: "m-browse-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.flow_run_id).toBe("active-run-route-biz");
      expect(result.outcome).toBe("advanced");
      // Verifies directory category list was sent rather than route_business menu
      expect(engineSendInteractiveList).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("చౌటుప్పల్ లోకల్ బిజినెస్ డైరెక్టరీ"),
          buttonLabel: "కేటగిరీలు చూడండి",
        }),
      );
      // Verifies directory vars were initialized
      expect(h.state.updated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: "flow_runs",
            patch: expect.objectContaining({
              vars: expect.objectContaining({
                dir_mode: true,
                dir_cat_page: 1,
              }),
            }),
          }),
        ]),
      );
    });

    it("2. biz_menu + opt_browse_directory triggers directory category list instead of repeating biz_menu", async () => {
      h.state.categories = sampleCategories;
      h.state.activeRuns = [
        {
          id: "active-run-biz-menu",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: {},
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: {
            text: "🏪 *చౌటుప్పల్ వ్యాపార సేవలు*",
            button_label: "సేవలు చూడండి",
            sections: [
              {
                title: "వ్యాపార సేవలు",
                rows: [
                  {
                    reply_id: "opt_business_listing",
                    title: "📇 Business Listing",
                    next_node_key: "resp_business_listing",
                  },
                  {
                    reply_id: "opt_browse_directory",
                    title: "🔎 Browse Businesses",
                    next_node_key: "biz_menu", // In flow_nodes this pointed to itself!
                  },
                ],
              },
            ],
          },
        },
      ];

      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "opt_browse_directory",
        reply_title: "🔎 Browse Businesses",
        meta_message_id: "m-browse-2",
      });

      expect(result.consumed).toBe(true);
      expect(result.flow_run_id).toBe("active-run-biz-menu");
      expect(result.outcome).toBe("advanced");
      expect(engineSendInteractiveList).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("చౌటుప్పల్ లోకల్ బిజినెస్ డైరెక్టరీ"),
          buttonLabel: "కేటగిరీలు చూడండి",
        }),
      );
    });

    it("3. Existing dir_* navigation continues working (select category and back to biz menu)", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = sampleListings;
      h.state.activeRuns = [
        {
          id: "active-run-dir-nav",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_cat_page: 1 },
          reprompt_count: 0,
        },
      ];
      const bizMenuNode = {
        id: "node-biz-menu",
        flow_id: "flow-biz",
        node_key: "biz_menu",
        node_type: "send_list",
        config: {
          text: "🏪 *చౌటుప్పల్ వ్యాపార సేవలు*",
          button_label: "సేవలు చూడండి",
          sections: [{ title: "వ్యాపార సేవలు", rows: [] }],
        },
      };
      h.state.nodes = [bizMenuNode];

      // 3a: Select category dir_cat_automobile
      const resultCat = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_cat_automobile",
        reply_title: "Automobile",
        meta_message_id: "m-cat-auto",
      });
      expect(resultCat.consumed).toBe(true);
      expect(resultCat.outcome).toBe("advanced");
      expect(engineSendInteractiveList).toHaveBeenCalledWith(
        expect.objectContaining({
          buttonLabel: "షాపులు చూడండి",
        }),
      );

      // 3b: Click dir_back_biz_menu
      engineSendInteractiveList.mockClear();
      const resultBack = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_back_biz_menu",
        reply_title: "🔙 Back to Menu",
        meta_message_id: "m-back-menu",
      });
      expect(resultBack.consumed).toBe(true);
      expect(resultBack.outcome).toBe("advanced");
      // Returned to biz_menu send_list
      expect(engineSendInteractiveList).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: "🏪 *చౌటుప్పల్ వ్యాపార సేవలు*",
        }),
      );
    });

    it("4. Normal opt_business_listing routing remains unchanged and advances to resp_business_listing", async () => {
      h.state.activeRuns = [
        {
          id: "active-run-normal",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: {},
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: {
            text: "🏪 *చౌటుప్పల్ వ్యాపార సేవలు*",
            button_label: "సేవలు చూడండి",
            sections: [
              {
                title: "వ్యాపార సేవలు",
                rows: [
                  {
                    reply_id: "opt_business_listing",
                    title: "📇 Business Listing",
                    next_node_key: "resp_business_listing",
                  },
                  {
                    reply_id: "opt_browse_directory",
                    title: "🔎 Browse Businesses",
                    next_node_key: "biz_menu",
                  },
                ],
              },
            ],
          },
        },
        {
          id: "node-resp-listing",
          flow_id: "flow-biz",
          node_key: "resp_business_listing",
          node_type: "send_message",
          config: {
            text: "కొత్త షాప్ నమోదు వివరాలు",
            next_node_key: "done",
          },
        },
        {
          id: "node-done",
          flow_id: "flow-biz",
          node_key: "done",
          node_type: "end",
          config: {},
        },
      ];

      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "opt_business_listing",
        reply_title: "📇 Business Listing",
        meta_message_id: "m-listing-normal",
      });

      expect(result.consumed).toBe(true);
      expect(result.flow_run_id).toBe("active-run-normal");
      expect(result.outcome).toBe("completed");
      expect(engineSendText).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "కొత్త షాప్ నమోదు వివరాలు",
        }),
      );
    });

    it("5. dir_item_* renders listing details using 3 interactive buttons (Call Now, WhatsApp, Back) without auto contact card", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = sampleListings;
      h.state.activeRuns = [
        {
          id: "active-run-item",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_category: "automobile", dir_list_page: 1 },
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: { text: "menu", button_label: "btn", sections: [] },
        },
      ];

      engineSendInteractiveButtons.mockClear();
      engineSendContact.mockClear();
      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_item_CPL-BIZ-001",
        reply_title: "S.S. Auto Electrical Works",
        meta_message_id: "m-item-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.outcome).toBe("advanced");

      // 1. Clean listing details message sent with exactly 3 buttons
      expect(engineSendInteractiveButtons).toHaveBeenCalledTimes(1);
      expect(engineSendInteractiveButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("S.S. Auto Electrical Works"),
          buttons: [
            { id: "dir_listpage_automobile_2", title: "తర్వాతి షాపులు ➡️" },
            { id: "dir_listpage_automobile_1", title: "🔙 వెనుకకు" },
            { id: "dir_browse", title: "📁 కేటగిరీలు" },
          ],
        }),
      );
      const detailsBody = ((engineSendInteractiveButtons.mock.calls as any)[0][0] as any).bodyText;
      expect(detailsBody).toContain("🏪 *_S.S. Auto Electrical Works_*");
      expect(detailsBody).toContain("📞 *ఫోన్:*");
      expect(detailsBody).not.toContain("Category:");
      expect(detailsBody).not.toContain("Subcategory:");
      expect(detailsBody).not.toContain("wa.me");
      expect(detailsBody).not.toContain("Contact: 9885374861");

      // 2. NO automatic contact card sent (unwanted save-contact experience prevented)
      expect(engineSendContact).not.toHaveBeenCalled();
    });

    it("6. dir_call_* sends direct dial assistance and navigation buttons without contact card", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = sampleListings;
      h.state.activeRuns = [
        {
          id: "active-run-call",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_category: "automobile", dir_list_page: 1 },
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: { text: "menu", button_label: "btn", sections: [] },
        },
      ];

      engineSendContact.mockClear();
      engineSendInteractiveButtons.mockClear();
      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_call_CPL-BIZ-001",
        reply_title: "📞 Call Now",
        meta_message_id: "m-call-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.outcome).toBe("advanced");

      // No contact card
      expect(engineSendContact).not.toHaveBeenCalled();

      // Direct dial assistance with tap-to-call number
      expect(engineSendInteractiveButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("+91 98853 74861"),
          buttons: expect.arrayContaining([
            { id: "dir_listpage_automobile_1", title: "🔙 Back" },
            { id: "dir_item_CPL-BIZ-001", title: "📋 Details" },
          ]),
        }),
      );
    });

    it("7. dir_wa_* dispatches interactive cta_url message with prefilled Telugu draft", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = sampleListings;
      h.state.activeRuns = [
        {
          id: "active-run-wa",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_category: "automobile", dir_list_page: 1 },
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: { text: "menu", button_label: "btn", sections: [] },
        },
      ];

      engineSendContact.mockClear();
      engineSendInteractiveCtaUrl.mockClear();
      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_wa_CPL-BIZ-001",
        reply_title: "💬 WhatsApp",
        meta_message_id: "m-wa-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.outcome).toBe("advanced");

      // No contact card
      expect(engineSendContact).not.toHaveBeenCalled();

      // Dispatched interactive CTA URL message
      expect(engineSendInteractiveCtaUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          displayText: "💬 WhatsApp చాట్",
          url: expect.stringContaining("https://wa.me/919885374861?text="),
          bodyText: expect.stringContaining("S.S. Auto Electrical Works"),
        }),
      );

      // Verify Telugu prefilled text includes Choutuppal App branding
      const sentUrl = ((engineSendInteractiveCtaUrl.mock.calls as any)[0][0] as any).url;
      expect(sentUrl).toContain(encodeURIComponent("Choutuppal App"));
      expect(sentUrl).toContain(encodeURIComponent("S.S. Auto Electrical Works"));
    });

    it("8. dir_call_* handles listing with missing phone cleanly", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = [
        {
          id: "biz-nophone",
          name: "No Phone Shop",
          category_slug: "automobile",
          phone: "",
          whatsapp_phone: "",
          status: "published",
          account_id: "acct-1",
          is_verified: false,
          is_premium: false,
          metadata: { listing_id: "CPL-BIZ-888" },
        },
      ];
      h.state.activeRuns = [
        {
          id: "active-run-nophone",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_category: "automobile", dir_list_page: 1 },
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: { text: "menu", button_label: "btn", sections: [] },
        },
      ];

      engineSendInteractiveButtons.mockClear();
      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_call_CPL-BIZ-888",
        reply_title: "📞 Call Now",
        meta_message_id: "m-call-nophone-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.outcome).toBe("advanced");
      expect(engineSendInteractiveButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("ఫోన్ నంబర్ అందుబాటులో లేదు"),
        }),
      );
    });

    it("9. dir_wa_* handles listing with missing WhatsApp number cleanly", async () => {
      h.state.categories = sampleCategories;
      h.state.listings = [
        {
          id: "biz-nowa",
          name: "No WA Shop",
          category_slug: "automobile",
          phone: "",
          whatsapp_phone: "",
          status: "published",
          account_id: "acct-1",
          is_verified: false,
          is_premium: false,
          metadata: { listing_id: "CPL-BIZ-999" },
        },
      ];
      h.state.activeRuns = [
        {
          id: "active-run-nowa",
          flow_id: "flow-biz",
          account_id: "acct-1",
          user_id: "u-1",
          contact_id: "ct-1",
          conversation_id: "cv-1",
          status: "active",
          current_node_key: "biz_menu",
          vars: { dir_mode: true, dir_category: "automobile", dir_list_page: 1 },
          reprompt_count: 0,
        },
      ];
      h.state.nodes = [
        {
          id: "node-biz-menu",
          flow_id: "flow-biz",
          node_key: "biz_menu",
          node_type: "send_list",
          config: { text: "menu", button_label: "btn", sections: [] },
        },
      ];

      engineSendInteractiveButtons.mockClear();
      const result = await dispatch({
        kind: "interactive_reply",
        reply_id: "dir_wa_CPL-BIZ-999",
        reply_title: "💬 WhatsApp",
        meta_message_id: "m-wa-nowa-1",
      });

      expect(result.consumed).toBe(true);
      expect(result.outcome).toBe("advanced");
      expect(engineSendInteractiveButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyText: expect.stringContaining("WhatsApp నంబర్ అందుబాటులో లేదు"),
        }),
      );
    });
  });
});
