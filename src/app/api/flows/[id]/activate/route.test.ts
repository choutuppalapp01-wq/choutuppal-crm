import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getUser: vi.fn(),
  existingFlow: vi.fn(),
  flowData: vi.fn(),
  nodesData: vi.fn(),
  otherActiveFlows: vi.fn(),
  updateFlow: vi.fn(),
}));

vi.mock("@/lib/auth/account", () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn(() => Response.json({ error: "auth failed" }, { status: 403 })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.existingFlow,
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/flows/admin-client", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (table: string) => {
      if (table === "flow_nodes") {
        return {
          select: () => ({
            eq: mocks.nodesData,
          }),
        };
      }
      return {
        select: (fields: string) => {
          if (fields.includes("account_id, name")) {
            return {
              eq: () => ({
                maybeSingle: mocks.flowData,
              }),
            };
          }
          // otherActiveFlows query
          return {
            eq: () => ({
              eq: () => ({
                neq: mocks.otherActiveFlows,
              }),
            }),
          };
        },
        update: mocks.updateFlow,
      };
    },
  })),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/flows/flow-1/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.requireRole.mockReset().mockResolvedValue(undefined);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.existingFlow.mockReset().mockResolvedValue({ data: { id: "flow-1" } });
  mocks.flowData.mockReset().mockResolvedValue({
    data: {
      account_id: "account-1",
      name: "New Flow",
      trigger_type: "keyword",
      trigger_config: { keywords: ["pricing"] },
      entry_node_id: "start",
    },
  });
  mocks.nodesData.mockReset().mockResolvedValue({
    data: [
      {
        node_key: "start",
        node_type: "start",
        config: { next_node_key: "msg_1" },
      },
      {
        node_key: "msg_1",
        node_type: "send_message",
        config: { text: "Pricing details", next_node_key: "end" },
      },
      {
        node_key: "end",
        node_type: "end",
        config: {},
      },
    ],
  });
  mocks.otherActiveFlows.mockReset().mockResolvedValue({ data: [] });
  mocks.updateFlow.mockReset().mockImplementation(() => ({
    eq: () => ({
      select: () => ({
        maybeSingle: async () => ({
          data: { id: "flow-1", status: "active" },
          error: null,
        }),
      }),
    }),
  }));
});

describe("POST /api/flows/[id]/activate", () => {
  it("activates successfully when graph is valid and no collision exists", async () => {
    const res = await POST(request({ status: "active" }), {
      params: Promise.resolve({ id: "flow-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flow).toMatchObject({ id: "flow-1", status: "active" });
  });

  it("rejects activation with 422 if a keyword collision exists with an active flow", async () => {
    mocks.otherActiveFlows.mockResolvedValue({
      data: [
        {
          id: "flow-99",
          name: "Existing Pricing Bot",
          trigger_type: "keyword",
          trigger_config: { keywords: ["pricing"] },
          status: "active",
        },
      ],
    });

    const res = await POST(request({ status: "active" }), {
      params: Promise.resolve({ id: "flow-1" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("collision detected");
    expect(body.collisions).toHaveLength(1);
    expect(body.collisions[0]).toMatchObject({
      conflictingFlowId: "flow-99",
      conflictingFlowName: "Existing Pricing Bot",
      conflictKey: "pricing",
    });
  });

  it("rejects activation with 422 if first_inbound_message collision exists", async () => {
    mocks.flowData.mockResolvedValue({
      data: {
        account_id: "account-1",
        name: "Second Inbound Handler",
        trigger_type: "first_inbound_message",
        trigger_config: {},
        entry_node_id: "start",
      },
    });

    mocks.otherActiveFlows.mockResolvedValue({
      data: [
        {
          id: "flow-88",
          name: "First Inbound Welcome",
          trigger_type: "first_inbound_message",
          trigger_config: {},
          status: "active",
        },
      ],
    });

    const res = await POST(request({ status: "active" }), {
      params: Promise.resolve({ id: "flow-1" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("collision detected");
    expect(body.collisions[0].triggerType).toBe("first_inbound_message");
  });

  it("allows setting status to draft unconditionally without collision check", async () => {
    mocks.updateFlow.mockImplementation(() => ({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: { id: "flow-1", status: "draft" },
            error: null,
          }),
        }),
      }),
    }));

    const res = await POST(request({ status: "draft" }), {
      params: Promise.resolve({ id: "flow-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flow.status).toBe("draft");
    expect(mocks.otherActiveFlows).not.toHaveBeenCalled();
  });
});
