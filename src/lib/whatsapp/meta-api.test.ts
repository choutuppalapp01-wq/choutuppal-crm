import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERACTIVE_LIMITS,
  buildContactMessagePayload,
  sendContactMessage,
  sendInteractiveButtons,
  sendInteractiveList,
} from "./meta-api";

// All assertions in this file run BEFORE the network call. We stub fetch
// to a never-resolving mock so a test that accidentally falls through to
// the request body would hang (and fail) rather than silently hit
// graph.facebook.com.
const neverFetch = () =>
  new Promise<Response>(() => {
    /* intentionally never resolves */
  });

const BASE_ARGS = {
  phoneNumberId: "test-phone",
  accessToken: "test-token",
  to: "1234567890",
  bodyText: "Body text",
} as const;

describe("WhatsApp contacts message payload", () => {
  it("A. buildContactMessagePayload includes first_name, formatted_name, +91 normalized phone, wa_id without +, and WORK type", () => {
    const payload = buildContactMessagePayload({
      to: "918790083706",
      contacts: [
        {
          name: "S.S. ఆటో ఎలక్ట్రికల్ వర్క్స్",
          phones: [{ phone: "9885374861" }],
        },
      ],
    });
    const contact = (payload.contacts as Array<Record<string, any>>)[0];
    expect(contact.name.formatted_name).toBe("S.S. ఆటో ఎలక్ట్రికల్ వర్క్స్");
    expect(contact.name.first_name).toBe("S.S. ఆటో ఎలక్ట్రికల్ వర్క్స్");
    expect(contact.phones[0].phone).toBe("+919885374861");
    expect(contact.phones[0].wa_id).toBe("919885374861");
    expect(contact.phones[0].type).toBe("WORK");
  });

  it("maps persisted contact data and multiple phones to Meta's contacts payload", () => {
    expect(
      buildContactMessagePayload({
        to: "15551234567",
        contacts: [
          {
            name: "Choutuppal App",
            phones: [
              { phone: "9441348175", type: "CUSTOMER_CARE" },
              { phone: "9494348175" },
            ],
          },
          {
            name: "Choutuppal Support",
            phones: [{ phone: "9441348176", type: "WORK" }],
          },
        ],
      }),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "15551234567",
      type: "contacts",
      contacts: [
        {
          name: { formatted_name: "Choutuppal App", first_name: "Choutuppal App" },
          phones: [
            { phone: "+919441348175", type: "CUSTOMER_CARE", wa_id: "919441348175" },
            { phone: "+919494348175", type: "WORK", wa_id: "919494348175" },
          ],
        },
        {
          name: { formatted_name: "Choutuppal Support", first_name: "Choutuppal Support" },
          phones: [{ phone: "+919441348176", type: "WORK", wa_id: "919441348176" }],
        },
      ],
    });
  });

  it("maps organization and multiple phones to Meta's contacts payload", () => {
    expect(
      buildContactMessagePayload({
        to: "15551234567",
        contacts: [
          {
            name: "Choutuppal App",
            org: {
              company: "Choutuppal Digital Services",
            },
            phones: [
              { phone: "+919441348175", type: "Help Line" },
              { phone: "+919494348175", type: "Bot Services" },
            ],
          },
        ],
      }),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "15551234567",
      type: "contacts",
      contacts: [
        {
          name: { formatted_name: "Choutuppal App", first_name: "Choutuppal App" },
          org: { company: "Choutuppal Digital Services" },
          phones: [
            { phone: "+919441348175", type: "Help Line", wa_id: "919441348175" },
            { phone: "+919494348175", type: "Bot Services", wa_id: "919494348175" },
          ],
        },
      ],
    });
  });

  it("sends the contacts payload with the existing Cloud API client", async () => {
    let capturedBody: unknown;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.CONTACT" }] }), { status: 200 });
    }));
    try {
      await expect(
        sendContactMessage({
          phoneNumberId: "test-phone",
          accessToken: "test-token",
          to: "1234567890",
          contacts: [{ name: "Support", phones: [{ phone: "5551234" }] }],
        }),
      ).resolves.toEqual({ messageId: "wamid.CONTACT" });
      expect(capturedBody).toMatchObject({
        type: "contacts",
        contacts: [
          {
            name: { formatted_name: "Support", first_name: "Support" },
            phones: [{ phone: "+5551234", type: "WORK", wa_id: "5551234" }],
          },
        ],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("surfaces Meta API failures for contact sends", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Unsupported contact" } }), { status: 400 }),
    ));
    try {
      await expect(
        sendContactMessage({
          phoneNumberId: "test-phone",
          accessToken: "test-token",
          to: "1234567890",
          contacts: [{ name: "Support", phones: [{ phone: "5551234" }] }],
        }),
      ).rejects.toThrow("Unsupported contact");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("sendInteractiveButtons — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an empty buttons array", async () => {
    await expect(
      sendInteractiveButtons({ ...BASE_ARGS, buttons: [] }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxButtons} buttons (Meta cap)`, async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
          { id: "d", title: "D" },
        ],
      }),
    ).rejects.toThrow(/1-3 buttons/);
  });

  it("rejects a button title longer than 20 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [
          { id: "a", title: "x".repeat(INTERACTIVE_LIMITS.buttonTitleMaxLength + 1) },
        ],
      }),
    ).rejects.toThrow(/exceeds 20 chars/);
  });

  it("rejects a button missing its id", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        buttons: [{ id: "", title: "Choose me" }],
      }),
    ).rejects.toThrow(/missing id/);
  });

  it("rejects an empty body text", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        bodyText: "",
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/requires bodyText/);
  });

  it("rejects a header text over the limit", async () => {
    await expect(
      sendInteractiveButtons({
        ...BASE_ARGS,
        headerText: "x".repeat(INTERACTIVE_LIMITS.headerTextMaxLength + 1),
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow(/headerText exceeds/);
  });

  it("sends the right payload shape when all inputs are valid", async () => {
    let captured: { url: string; body: unknown; method: string } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        captured = {
          url,
          method: init.method ?? "GET",
          body: JSON.parse(String(init.body)),
        };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.PASS" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveButtons({
      ...BASE_ARGS,
      headerText: "Hello",
      footerText: "Tap one",
      buttons: [
        { id: "yes", title: "Yes" },
        { id: "no", title: "No" },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.PASS" });
    expect(captured).not.toBeNull();
    expect(captured!.method).toBe("POST");
    expect(captured!.url).toContain("test-phone/messages");
    expect(captured!.body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "1234567890",
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Body text" },
        header: { type: "text", text: "Hello" },
        footer: { text: "Tap one" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes", title: "Yes" } },
            { type: "reply", reply: { id: "no", title: "No" } },
          ],
        },
      },
    });
  });
});

describe("sendInteractiveList — validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(neverFetch));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ROW = { id: "r1", title: "Row 1" };

  it("rejects zero sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [],
      }),
    ).rejects.toThrow(/1-10 sections/);
  });

  it(`rejects more than ${INTERACTIVE_LIMITS.maxListRowsTotal} rows total across sections (Meta cap)`, async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `r${i}`,
      title: `Row ${i}`,
    }));
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [{ rows }],
      }),
    ).rejects.toThrow(/1-10 rows total/);
  });

  it("rejects a row title longer than 24 chars (Meta cap)", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          {
            rows: [
              {
                id: "r1",
                title: "x".repeat(INTERACTIVE_LIMITS.listRowTitleMaxLength + 1),
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/exceeds 24 chars/);
  });

  it("rejects duplicate row ids across sections", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "Open",
        sections: [
          { rows: [{ id: "dupe", title: "First" }] },
          { rows: [{ id: "dupe", title: "Second" }] },
        ],
      }),
    ).rejects.toThrow(/duplicate row id/);
  });

  it("rejects an empty buttonLabel", async () => {
    await expect(
      sendInteractiveList({
        ...BASE_ARGS,
        buttonLabel: "",
        sections: [{ rows: [ROW] }],
      }),
    ).rejects.toThrow(/requires a buttonLabel/);
  });

  it("sends the right payload shape when valid", async () => {
    let captured: { body: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = { body: JSON.parse(String(init.body)) };
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.LIST" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await sendInteractiveList({
      ...BASE_ARGS,
      buttonLabel: "Open menu",
      sections: [
        {
          title: "Orders",
          rows: [
            { id: "order_1", title: "Order #1", description: "€12" },
            { id: "order_2", title: "Order #2" },
          ],
        },
      ],
    });

    expect(result).toEqual({ messageId: "wamid.LIST" });
    expect(captured).not.toBeNull();
    expect(captured!.body).toMatchObject({
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Body text" },
        action: {
          button: "Open menu",
          sections: [
            {
              title: "Orders",
              rows: [
                { id: "order_1", title: "Order #1", description: "€12" },
                { id: "order_2", title: "Order #2" },
              ],
            },
          ],
        },
      },
    });
  });
});
