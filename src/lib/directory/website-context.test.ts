import { describe, it, expect } from "vitest";
import {
  buildContextualWhatsAppUrl,
  parseWebsiteContext,
  resolveTargetFlowSlug,
  type WebsiteContext,
} from "./website-context";

describe("Website Context Routing — URL Builder", () => {
  it("builds a basic contextual WhatsApp URL with canonical source", () => {
    const url = buildContextualWhatsAppUrl({
      phoneNumber: "+919441348175",
      context: {
        source: "website",
        source_page: "business-listing",
        source_button: "whatsapp",
        listing_id: "biz-123",
        intent: "business_enquiry",
      },
      humanMessage: "Hi, I need details about this listing.",
    });

    expect(url).toContain("https://wa.me/919441348175?text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Hi, I need details about this listing.");
    expect(decoded).toContain(
      "[CTX source=website page=business-listing button=whatsapp intent=business_enquiry listing_id=biz-123]",
    );
  });

  it("handles Telugu text and Unicode safely without corruption", () => {
    const url = buildContextualWhatsAppUrl({
      phoneNumber: "9494348175",
      context: {
        source: "website",
        service: "real_estate",
        intent: "property_enquiry",
        property_id: "prop-999",
      },
      humanMessage: "నమస్కారం! నాకు ఈ స్థలం వివరాలు కావాలి.",
    });

    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("నమస్కారం! నాకు ఈ స్థలం వివరాలు కావాలి.");
    expect(decoded).toContain(
      "[CTX source=website service=real_estate intent=property_enquiry property_id=prop-999]",
    );
  });

  it("handles missing optional fields cleanly", () => {
    const url = buildContextualWhatsAppUrl({
      phoneNumber: "919441348175",
      context: {
        source: "website",
      },
    });

    const decoded = decodeURIComponent(url);
    expect(decoded).toBe("https://wa.me/919441348175?text=[CTX source=website]");
  });

  it("sanitizes unsafe / malicious input in URL builder", () => {
    const url = buildContextualWhatsAppUrl({
      phoneNumber: "919441348175",
      context: {
        source: "website",
        listing_id: "<script>alert('xss')</script>",
        source_page: "page'; DROP TABLE contacts;--",
      },
    });

    const decoded = decodeURIComponent(url);
    // Malicious values rejected by regex validation
    expect(decoded).not.toContain("<script>");
    expect(decoded).not.toContain("DROP TABLE");
    expect(decoded).toBe("https://wa.me/919441348175?text=[CTX source=website]");
  });
});

describe("Website Context Routing — Context Parser", () => {
  it("parses valid website context tag from message", () => {
    const msg =
      "Hello team!\n\n[CTX source=website page=premium-listing button=whatsapp listing_id=biz-789 intent=premium_enquiry service=premium_listing]";
    const res = parseWebsiteContext(msg);
    expect(res).not.toBeNull();
    expect(res?.cleanText).toBe("Hello team!");
    expect(res?.context).toEqual({
      source: "website",
      source_page: "premium-listing",
      source_button: "whatsapp",
      listing_id: "biz-789",
      intent: "premium_enquiry",
      service: "premium_listing",
    });
  });

  it("returns null for messages without context tag", () => {
    expect(parseWebsiteContext("Hi, just checking in.")).toBeNull();
    expect(parseWebsiteContext("")).toBeNull();
    expect(parseWebsiteContext(null)).toBeNull();
    expect(parseWebsiteContext(undefined)).toBeNull();
  });

  it("rejects untrusted / non-website source values", () => {
    const msg = "[CTX source=external_hack page=landing]";
    expect(parseWebsiteContext(msg)).toBeNull();
  });

  it("ignores unknown fields and prevents duplicate key pollution", () => {
    const msg =
      "[CTX source=website admin_token=secret_123 listing_id=123 listing_id=evil_id unknown_attr=value]";
    const res = parseWebsiteContext(msg);
    expect(res).not.toBeNull();
    expect(res?.context.listing_id).toBe("123");
    expect((res?.context as unknown as Record<string, unknown>).admin_token).toBeUndefined();
    expect((res?.context as unknown as Record<string, unknown>).unknown_attr).toBeUndefined();
  });

  it("sanitizes XSS and SQL injection payloads by treating them as untrusted strings", () => {
    const msg =
      "[CTX source=website listing_id=<script>bad()</script> flow_slug=' OR 1=1;-- ref=valid_campaign]";
    const res = parseWebsiteContext(msg);
    expect(res).not.toBeNull();
    // Invalid characters rejected by regex/allowlist
    expect(res?.context.listing_id).toBeUndefined();
    expect(res?.context.flow_slug).toBeUndefined();
    expect(res?.context.ref).toBe("valid_campaign");
  });

  it("enforces length bounds and rejects excessively long IDs", () => {
    const longId = "a".repeat(128);
    const msg = `[CTX source=website listing_id=${longId}]`;
    const res = parseWebsiteContext(msg);
    expect(res?.context.listing_id).toBeUndefined();
  });
});

describe("Website Context Routing — Deterministic Slug Resolver", () => {
  it("resolves explicit allowlisted flow_slug with highest priority", () => {
    const ctx: WebsiteContext = {
      source: "website",
      flow_slug: "real_estate",
      service: "jobs", // conflicting service
    };
    expect(resolveTargetFlowSlug(ctx)).toBe("real_estate");
  });

  it("resolves premium_listing service and intent", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "premium_listing",
      }),
    ).toBe("premium_listing");

    expect(
      resolveTargetFlowSlug({
        source: "website",
        intent: "premium_enquiry",
      }),
    ).toBe("premium_listing");
  });

  it("resolves real_estate service and intent", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "real_estate",
      }),
    ).toBe("real_estate");

    expect(
      resolveTargetFlowSlug({
        source: "website",
        intent: "property_enquiry",
      }),
    ).toBe("real_estate");
  });

  it("resolves jobs service and intent", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "jobs",
      }),
    ).toBe("jobs");

    expect(
      resolveTargetFlowSlug({
        source: "website",
        intent: "job_enquiry",
      }),
    ).toBe("jobs");
  });

  it("resolves promotion and whatsapp automation services", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "promotion_services",
      }),
    ).toBe("promotion_services");

    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "whatsapp_automation",
      }),
    ).toBe("promotion_services");
  });

  it("resolves local directory and business listing", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
        service: "local_directory",
      }),
    ).toBe("local_directory");

    expect(
      resolveTargetFlowSlug({
        source: "website",
        source_page: "business-listing",
      }),
    ).toBe("local_directory");
  });

  it("returns null for unknown context without valid mappings", () => {
    expect(
      resolveTargetFlowSlug({
        source: "website",
      }),
    ).toBeNull();
  });
});
