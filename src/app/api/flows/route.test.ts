import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  insertFlow: vi.fn(),
  insertNodes: vi.fn(),
  deleteFlow: vi.fn(),
}));

vi.mock("@/lib/auth/account", () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn(() => Response.json({ error: "auth failed" }, { status: 403 })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.profileSingle }) }) }),
  })),
}));

vi.mock("@/lib/flows/admin-client", () => ({
  supabaseAdmin: vi.fn(() => ({
    from: (table: string) => table === "flows"
      ? { insert: mocks.insertFlow, delete: mocks.deleteFlow }
      : { insert: mocks.insertNodes },
  })),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/flows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.requireRole.mockReset().mockResolvedValue(undefined);
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.profileSingle.mockReset().mockResolvedValue({ data: { account_id: "account-1" } });
  mocks.insertFlow.mockReset().mockImplementation((payload) => ({
    select: () => ({ single: async () => ({ data: { id: "flow-1", ...payload }, error: null }) }),
  }));
  mocks.insertNodes.mockReset().mockResolvedValue({ error: null });
  mocks.deleteFlow.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
});

describe("POST /api/flows template clone", () => {
  it("stores CSV values in the Flow and cloned graph", async () => {
    const payload = {
      name: "Welcome Menu CSV",
      description: "CSV description",
      trigger_type: "keyword",
      trigger_keywords: ["Hi", "hi", "Hello", "ನಮಸ್ಕಾರ", "హాయ్"],
      initial_message: "నమస్కారం! చౌటుప్పల్ యాప్‌కి స్వాగతం!",
      button_options: ["సేవలు", "వ్యాపారాలు", "సహాయం"],
      template_slug: "welcome_menu",
    };

    const response = await POST(request(payload));
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.insertFlow).toHaveBeenCalledWith(expect.objectContaining({
      name: payload.name,
      description: payload.description,
      trigger_type: "keyword",
      trigger_config: { keywords: payload.trigger_keywords, match_type: "contains" },
    }));
    expect(mocks.insertNodes).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        node_key: "welcome",
        config: expect.objectContaining({
          text: payload.initial_message,
          buttons: expect.arrayContaining([
            expect.objectContaining({ title: "సేవలు", next_node_key: "handoff_1" }),
            expect.objectContaining({ title: "వ్యాపారాలు" }),
            expect.objectContaining({ title: "సహాయం" }),
          ]),
        }),
      }),
      expect.objectContaining({ node_key: "handoff_1", node_type: "handoff" }),
    ]));
    expect(responseBody.flow.id).toBe("flow-1");
  });

  it("keeps non-template keyword Flow creation compatible", async () => {
    const response = await POST(request({
      name: "Existing CSV Flow",
      trigger_type: "keyword",
      trigger_keywords: ["Hi", "hello"],
      trigger_config: { keywords: ["legacy"], match_type: "contains" },
    }));
    expect(response.status).toBe(201);
    expect(mocks.insertFlow).toHaveBeenCalledWith(expect.objectContaining({
      name: "Existing CSV Flow",
      trigger_type: "keyword",
      trigger_config: { keywords: ["Hi", "hello"], match_type: "contains" },
    }));
  });

  it("creates a flow from template without explicit name, using the template canonical name", async () => {
    const response = await POST(request({
      template_slug: "welcome_menu",
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(mocks.insertFlow).toHaveBeenCalledWith(expect.objectContaining({
      name: "Choutuppal Welcome Menu",
      account_id: "account-1",
      status: "draft",
    }));
    expect(body.flow.id).toBe("flow-1");
  });

  it("creates a flow from template with custom explicit name", async () => {
    const response = await POST(request({
      template_slug: "welcome_menu",
      name: "My Custom Welcome",
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(mocks.insertFlow).toHaveBeenCalledWith(expect.objectContaining({
      name: "My Custom Welcome",
      account_id: "account-1",
      status: "draft",
    }));
    expect(body.flow.id).toBe("flow-1");
  });

  it("returns 400 'name is required' for blank flow without name", async () => {
    const response = await POST(request({}));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("name is required");
    expect(mocks.insertFlow).not.toHaveBeenCalled();
  });

  it("returns 400 'name is required' for blank flow with whitespace-only name", async () => {
    const response = await POST(request({ name: "   " }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("name is required");
    expect(mocks.insertFlow).not.toHaveBeenCalled();
  });

  it("returns a clear 400 for an unknown template before inserting", async () => {
    const response = await POST(request({
      name: "Unknown template",
      trigger_type: "keyword",
      trigger_keywords: ["hello"],
      template_slug: "missing_template",
    }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('Unknown template_slug "missing_template"');
    expect(mocks.insertFlow).not.toHaveBeenCalled();
    expect(mocks.insertNodes).not.toHaveBeenCalled();
  });
});
