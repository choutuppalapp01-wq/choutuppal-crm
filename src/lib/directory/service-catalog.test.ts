import { describe, it, expect } from "vitest";
import {
  listServiceCategories,
  listServices,
  getServiceBySlug,
  getCategoryBySlug,
  KNOWN_SERVICE_TAGS,
} from "./service-catalog";
import { getFlowTemplate } from "@/lib/flows/templates";
import { validateFlowForActivation } from "@/lib/flows/validate";
import { resolveTargetFlowSlug } from "./website-context";

describe("Service Catalog Foundation (Batch 07)", () => {
  it("provides all required 15 service categories", () => {
    const categories = listServiceCategories();
    expect(categories.length).toBeGreaterThanOrEqual(15);

    const slugs = categories.map((c) => c.slug);
    const requiredSlugs = [
      "my_business",
      "promotions",
      "design_video",
      "whatsapp_marketing",
      "ads_campaigns",
      "premium_listing",
      "real_estate",
      "jobs",
      "finance",
      "insurance",
      "deals",
      "affiliate",
      "local_services",
      "greetings",
      "wa_automation",
    ];

    for (const req of requiredSlugs) {
      expect(slugs).toContain(req);
      const cat = getCategoryBySlug(req);
      expect(cat).not.toBeNull();
      expect(cat?.name_te).toBeDefined();
      expect(cat?.name_en).toBeDefined();
    }
  });

  it("provides comprehensive active services with valid flow slugs and lead tags", () => {
    const services = listServices();
    expect(services.length).toBeGreaterThanOrEqual(14);

    for (const s of services) {
      expect(s.slug.length).toBeGreaterThan(0);
      expect(s.flow_slug.length).toBeGreaterThan(0);
      expect(s.lead_tag.length).toBeGreaterThan(0);
      expect(s.lead_tag.startsWith("tag_")).toBe(true);
      expect(s.requirement_fields.length).toBeGreaterThan(0);

      // Verify the mapped flow template actually exists
      const template = getFlowTemplate(s.flow_slug);
      expect(template, `Service ${s.slug} maps to missing flow template ${s.flow_slug}`).not.toBeNull();
    }
  });

  it("filters services by category slug accurately", () => {
    const promoServices = listServices("promotions");
    expect(promoServices.length).toBeGreaterThan(0);
    for (const s of promoServices) {
      expect(s.category_slug).toBe("promotions");
    }

    const jobServices = listServices("jobs");
    expect(jobServices.length).toBe(2);
    expect(jobServices.map((j) => j.slug)).toContain("job_search");
    expect(jobServices.map((j) => j.slug)).toContain("post_job");
  });

  it("returns null for non-existent service or category slug", () => {
    expect(getServiceBySlug("non_existent_service")).toBeNull();
    expect(getCategoryBySlug("non_existent_category")).toBeNull();
  });

  it("verifies service_catalog flow template graph validation and Meta limits", () => {
    const template = getFlowTemplate("service_catalog");
    expect(template).not.toBeNull();
    if (!template) return;

    const issues = validateFlowForActivation(
      {
        name: template.name,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_config as Record<string, unknown>,
        entry_node_id: template.entry_node_id,
      },
      template.nodes as Array<{
        node_key: string;
        node_type: string;
        config: Record<string, unknown>;
      }>,
    );

    expect(issues).toEqual([]);
  });

  it("verifies interactive button titles in service_catalog template are within 20 chars", () => {
    const template = getFlowTemplate("service_catalog");
    expect(template).not.toBeNull();
    if (!template) return;

    for (const node of template.nodes) {
      if (node.node_type === "send_buttons") {
        const buttons = (node.config as { buttons?: Array<{ title: string }> }).buttons ?? [];
        expect(buttons.length).toBeGreaterThanOrEqual(1);
        expect(buttons.length).toBeLessThanOrEqual(3);
        for (const b of buttons) {
          expect(b.title.trim().length).toBeGreaterThan(0);
          expect(b.title.length).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("correctly routes website context to service_catalog flow", () => {
    const routedService = resolveTargetFlowSlug({
      source: "website",
      service: "service_catalog",
    });
    expect(routedService).toBe("service_catalog");

    const routedFinance = resolveTargetFlowSlug({
      source: "website",
      service: "loans_finance",
      intent: "finance_enquiry",
    });
    expect(routedFinance).toBe("service_catalog");

    const routedInsurance = resolveTargetFlowSlug({
      source: "website",
      service: "insurance",
      intent: "insurance_enquiry",
    });
    expect(routedInsurance).toBe("service_catalog");
  });

  it("maintains consistent lead tag conventions", () => {
    expect(KNOWN_SERVICE_TAGS.VIDEO_PROMOTION).toBe("tag_video_promotion");
    expect(KNOWN_SERVICE_TAGS.CREATIVE_DESIGN).toBe("tag_creative_design");
    expect(KNOWN_SERVICE_TAGS.WHATSAPP_MARKETING).toBe("tag_whatsapp_marketing");
    expect(KNOWN_SERVICE_TAGS.ADS_CAMPAIGN).toBe("tag_ads_campaign");
    expect(KNOWN_SERVICE_TAGS.PREMIUM_LISTING).toBe("tag_premium_listing");
    expect(KNOWN_SERVICE_TAGS.OWNER_LISTING).toBe("tag_owner_listing");
    expect(KNOWN_SERVICE_TAGS.TENANT_SEEKER).toBe("tag_tenant_seeker");
    expect(KNOWN_SERVICE_TAGS.JOB_SEEKER).toBe("tag_job_seeker");
    expect(KNOWN_SERVICE_TAGS.EMPLOYER_JOB).toBe("tag_employer_job");
    expect(KNOWN_SERVICE_TAGS.FINANCE_LEAD).toBe("tag_finance_lead");
    expect(KNOWN_SERVICE_TAGS.INSURANCE_LEAD).toBe("tag_insurance_lead");
    expect(KNOWN_SERVICE_TAGS.DEAL_SHOPPER).toBe("tag_deal_shopper");
    expect(KNOWN_SERVICE_TAGS.WHATSAPP_AUTOMATION_LEAD).toBe("tag_whatsapp_automation_lead");
  });
});
