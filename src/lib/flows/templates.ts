/**
 * Starter flow templates.
 * Choutuppal App WhatsApp CRM Engine
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Welcome menu — Choutuppal Pure Telugu & Native vCard Default
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: "Choutuppal Welcome Menu",
  description:
    "చౌటుప్పల్ యాప్ అధికారిక వెల్‌కమ్, కాంటాక్ట్ సేవ్ (vCard) మరియు సర్వీసెస్ మెనూ.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: {
    keywords: [
      "Hi",
      "hi",
      "HI",
      "Hello",
      "hello",
      "నమస్కారం",
      "హాయ్",
      "నమస్తే",
      "start",
      "Start",
      "Menu",
      "menu",
      "test",
    ],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "నమస్కారం! 🙏\nచౌటుప్పల్ యాప్‌కి స్వాగతం.\nమన చౌటుప్పల్ స్థానిక సమాచారం, ప్రభుత్వ సేవలు మరియు వ్యాపార వివరాలను WhatsAppలోనే సులభంగా పొందవచ్చు.\n\n📇 ముందుగా మా నంబర్లను 'Choutuppal App' పేరుతో సేవ్ చేసుకోండి:\n📱 9441348175 (హెల్ప్‌లైన్)\n🤖 9494348175 (బాట్ సేవలు)\n📥 Contact Card: https://choutuppal.in/assets/Choutuppal_App.vcf\n\nముందుకు వెళ్లడానికి క్రింది బటన్ నొక్కండి:",
        footer_text: "🌐 https://choutuppal.in",
        media_type: "contact",
        media_url: "https://choutuppal.in/assets/Choutuppal_App.vcf",
        contact_name: "Choutuppal App",
        contact_phones: ["+919441348175", "+919494348175"],
        buttons: [
          {
            reply_id: "btn_start",
            title: "సేవలు ప్రారంభించండి",
            next_node_key: "handoff_1",
          },
        ],
      } as SendButtonsNodeConfig & Record<string, unknown>,
    },
    {
      node_key: "handoff_1",
      node_type: "handoff",
      config: {
        note: "Customer tapped సేవలు ప్రారంభించండి from Welcome Menu.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: "FAQ bot",
  description:
    "Answer common questions automatically. Customer picks a topic from a list; the bot replies with the answer and ends.",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["faq", "question", "info", "సహాయం"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: "మీకు ఏ సమాచారం కావాలి?",
        button_label: "వివరాలు చూడండి",
        sections: [
          {
            title: "సాధారణ సేవలు",
            rows: [
              {
                reply_id: "hours",
                title: "సేవా సమయాలు",
                next_node_key: "answer_hours",
              },
              {
                reply_id: "pricing",
                title: "డిజిటల్ ప్రమోషన్ ధరలు",
                next_node_key: "answer_pricing",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "answer_hours",
      node_type: "send_message",
      config: {
        text: "మా సేవలు 24/7 WhatsAppలో అందుబాటులో ఉంటాయి. ప్రత్యక్ష సహాయం ఉదయం 9 నుండి రాత్రి 8 వరకు ఉంటుంది.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "answer_pricing",
      node_type: "send_message",
      config: {
        text: "పోస్టర్ డిజైన్, రీల్స్ & ప్రమోషన్ వివరాల కోసం: https://choutuppal.in",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: "Lead capture",
  description: "కొత్త లీడ్ వివరాలు సేకరించి సేల్స్ టీమ్‌కి పంపడం.",
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "intro" },
    },
    {
      node_key: "intro",
      node_type: "send_message",
      config: {
        text: "నమస్కారం! 🙏 మీ వ్యాపార వివరాలు సేకరించడానికి కొన్ని ప్రశ్నలు అడుగుతాము.",
        next_node_key: "ask_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "ask_name",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ పేరు ఏమిటి?",
        var_key: "name",
        next_node_key: "ask_phone",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "ధన్యవాదాలు {{vars.name}}! మీ ఫోన్ నంబర్ ఇవ్వండి:",
        var_key: "phone",
        next_node_key: "handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New lead — name={{vars.name}}, phone={{vars.phone}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}

/**
 * Clones a starter template and overlays custom CSV import fields
 */
export function buildTemplateWithOverrides(
  slug: string,
  overrides: {
    name?: string;
    description?: string | null;
    initial_message?: string;
    button_options?: string[];
    trigger_type?: "keyword" | "first_inbound_message" | "manual";
    trigger_keywords?: string[];
    media_type?: "image" | "contact" | "none";
    media_url?: string;
  }
): FlowTemplate | null {
  const base = getFlowTemplate(slug);
  if (!base) return null;

  // Deep clone base template structure
  const cloned: FlowTemplate = JSON.parse(JSON.stringify(base));

  if (overrides.name?.trim()) {
    cloned.name = overrides.name.trim();
  }
  if (
    overrides.description !== undefined &&
    overrides.description !== null &&
    overrides.description.trim() !== ""
  ) {
    cloned.description = overrides.description.trim();
  }
  if (overrides.trigger_type) {
    cloned.trigger_type = overrides.trigger_type;
  }
  if (
    overrides.trigger_keywords &&
    overrides.trigger_keywords.length > 0 &&
    cloned.trigger_type === "keyword"
  ) {
    cloned.trigger_config = {
      keywords: overrides.trigger_keywords,
      match_type: "contains",
    };
  }

  // Locate the entry node pointed to by 'start'
  const startNode = cloned.nodes.find((n) => n.node_type === "start");
  const entryMsgKey =
    (startNode?.config as { next_node_key?: string })?.next_node_key || "welcome";
  const entryMsgNode = cloned.nodes.find((n) => n.node_key === entryMsgKey);

  // 1. Override initial greeting message text
  if (overrides.initial_message && entryMsgNode) {
    if ("text" in entryMsgNode.config) {
      (entryMsgNode.config as { text: string }).text = overrides.initial_message;
    } else if ("prompt_text" in entryMsgNode.config) {
      (entryMsgNode.config as { prompt_text: string }).prompt_text = overrides.initial_message;
    }
  }

  // 2. Attach Media (Photo / vCard)
  if (entryMsgNode) {
    const cfg = entryMsgNode.config as Record<string, unknown>;
    if (overrides.media_type) {
      cfg.media_type = overrides.media_type;
    }
    if (overrides.media_url) {
      cfg.media_url = overrides.media_url;
      if (overrides.media_type === "image") {
        cfg.header_image_url = overrides.media_url;
      }
    }
  }

  // 3. Override interactive button options dynamically
  if (overrides.button_options && overrides.button_options.length > 0 && entryMsgNode) {
    const rawButtons = overrides.button_options.slice(0, 3);

    const newButtons: SendButtonsNodeConfig["buttons"] = [];
    const newHandoffNodes: FlowTemplateNode[] = [];

    rawButtons.forEach((title, idx) => {
      const reply_id = `btn_${idx + 1}`;
      const next_node_key = `handoff_${idx + 1}`;
      newButtons.push({
        reply_id,
        title: title.slice(0, 20),
        next_node_key,
      });

      newHandoffNodes.push({
        node_key: next_node_key,
        node_type: "handoff",
        config: {
          note: `Customer selected "${title}" from ${cloned.name}.`,
        } as HandoffNodeConfig,
      });
    });

    if (entryMsgNode.node_type === "send_buttons") {
      const cfg = entryMsgNode.config as SendButtonsNodeConfig;
      cfg.buttons = newButtons;
    } else {
      entryMsgNode.node_type = "send_buttons";
      entryMsgNode.config = {
        text:
          (entryMsgNode.config as { text?: string }).text ||
          overrides.initial_message ||
          "స్వాగతం!",
        buttons: newButtons,
        ...(entryMsgNode.config as Record<string, unknown>),
      };
    }

    const preservedNodes = cloned.nodes.filter(
      (n) => n.node_key === "start" || n.node_key === entryMsgKey
    );
    cloned.nodes = [...preservedNodes, ...newHandoffNodes];
  }

  return cloned;
}
