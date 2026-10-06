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
  SendContactNodeConfig,
  SendListNodeConfig,
  SendMediaNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";
import { reachableFromEntry } from "./validate";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "send_media"
  | "send_contact"
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
    | SendMediaNodeConfig
    | SendContactNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  icon:
    | "MessageSquare"
    | "HelpCircle"
    | "UserPlus"
    | "Compass"
    | "Store"
    | "Sparkles"
    | "Megaphone"
    | "Building2"
    | "Briefcase";
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
    match_type: "word",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "contact_card" },
    },
    {
      node_key: "contact_card",
      node_type: "send_contact",
      config: {
        name: "Choutuppal App",
        contact_name: "Choutuppal App",
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
        next_node_key: "welcome",
      } as SendContactNodeConfig,
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "నమస్కారం! 🙏\nచౌటుప్పల్ యాప్‌కి స్వాగతం.\nమన చౌటుప్పల్ స్థానిక సమాచారం, ప్రభుత్వ సేవలు మరియు వ్యాపార వివరాలను WhatsAppలోనే సులభంగా పొందవచ్చు.\n\n📇 పైన పంపిన Contact Card ద్వారా మా నంబర్లను సులభంగా సేవ్ చేసుకోండి:\n📱 9441348175 (హెల్ప్‌లైన్)\n🤖 9494348175 (బాట్ సేవలు)\n\nముందుకు వెళ్లడానికి క్రింది బటన్ నొక్కండి:",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          {
            reply_id: "btn_start",
            title: "సేవలు ప్రారంభించండి",
            next_node_key: "handoff_1",
          },
        ],
      } as SendButtonsNodeConfig,
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
// 4. Welcome Menu V2 (Pure Telugu, vCard Contact, 3-Button Gateway)
// ============================================================
const WELCOME_MENU_V2: FlowTemplate = {
  slug: "welcome_menu_v2",
  name: "Choutuppal Welcome Menu V2",
  description: "చౌటుప్పల్ అధికారిక WhatsApp మెనూ: లోకల్ డైరెక్టరీ, వ్యాపార ప్రమోషన్స్ & నేరుగా కాంటాక్ట్ కార్డ్ సేవలు.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["Hi", "hi", "HI", "Hello", "hello", "నమస్కారం", "హాయ్", "నమస్తే", "Menu", "మెనూ", "start"],
    match_type: "word",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome_intro" },
    },
    {
      node_key: "welcome_intro",
      node_type: "send_buttons",
      config: {
        text: "నమస్కారం! 🙏 చౌటుప్పల్ యాప్‌కి స్వాగతం.\n\nమన చౌటుప్పల్ పట్టణ మరియు పరిసర ప్రాంతాల వ్యాపార సమాచారం, అత్యవసర సేవలు మరియు స్థానిక అప్‌డేట్స్ కోసం క్రింది ఆప్షన్ ఎంచుకోండి.",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          { reply_id: "btn_dir", title: "డైరెక్టరీ", next_node_key: "goto_directory" },
          { reply_id: "btn_biz", title: "వ్యాపారం", next_node_key: "goto_business" },
          { reply_id: "btn_more", title: "ఇతర సేవలు", next_node_key: "goto_more_services" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "goto_directory",
      node_type: "send_message",
      config: {
        text: "🔍 *చౌటుప్పల్ లోకల్ డైరెక్టరీ*\n\nషాపులు, ఆస్పత్రులు, ఆటో/ట్యాక్సీ మరియు నిపుణుల సేవల కోసం 'డైరెక్టరీ' అని మెసేజ్ చేయండి లేదా డైరెక్టరీ మెనూని చూడండి.\n\n🌐 https://choutuppal.in/directory",
        next_node_key: "send_app_vcard",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "goto_business",
      node_type: "send_message",
      config: {
        text: "💼 *మీ వ్యాపార ప్రమోషన్*\n\nమీ షాప్ లేదా సర్వీస్‌ను వేలాది మంది చౌటుప్పల్ ప్రజలకు చేరువ చేయండి!\n\nప్రీమియం లిస్టింగ్, వీడియో రీల్స్, పోస్టర్ డిజైన్ వివరాల కోసం 'వ్యాపారం' అని పంపండి.\n🌐 https://choutuppal.in/business",
        next_node_key: "send_app_vcard",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "goto_more_services",
      node_type: "send_buttons",
      config: {
        text: "✨ *ఇతర స్థానిక సేవలు*\n\nమీరు ఏ సమాచారం కోసం చూస్తున్నారు?",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          { reply_id: "btn_helpline", title: "హెల్ప్‌లైన్", next_node_key: "send_app_vcard" },
          { reply_id: "btn_services_menu", title: "సేవల మెనూ", next_node_key: "services_info" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "services_info",
      node_type: "send_message",
      config: {
        text: "📋 *చౌటుప్పల్ యాప్ ప్రత్యేక సేవలు:*\n\n1. స్థానిక వ్యాపార డైరెక్టరీ\n2. రియల్ ఎస్టేట్ ప్లాట్లు & ఇళ్ళు\n3. లోకల్ ఉద్యోగ సమాచారం\n4. సోషల్ మీడియా రీల్స్ & ప్రమోషన్స్\n\n💡 మీ వ్యాపార వీడియో ప్రమోషన్ల కోసం: 9441348175\n🌐 https://choutuppal.in",
        next_node_key: "send_app_vcard",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "send_app_vcard",
      node_type: "send_contact",
      config: {
        name: "Choutuppal App",
        contact_name: "Choutuppal App",
        contacts: [
          {
            name: "Choutuppal App Helpline",
            phones: [
              { phone: "+919441348175", type: "Helpline" },
              { phone: "+919494348175", type: "Bot" },
            ],
          },
        ],
        next_node_key: "vcard_completion",
      },
    },
    {
      node_key: "vcard_completion",
      node_type: "send_message",
      config: {
        text: "✅ మా నంబర్‌ను సేవ్ చేసుకున్నందుకు ధన్యవాదాలు! ఏ సహాయం కావాలన్నా ఎప్పుడైనా ఇక్కడ మెసేజ్ చేయవచ్చు.",
        next_node_key: "end_welcome",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "end_welcome",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 5. Local Directory (Multi-Category Interactive List)
// ============================================================
const LOCAL_DIRECTORY: FlowTemplate = {
  slug: "local_directory",
  name: "Local Directory",
  description: "చౌటుప్పల్ స్థానిక వ్యాపారాలు, ఆటోలు, అత్యవసర సేవలు మరియు నిపుణుల జాబితా.",
  icon: "Compass",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["డైరెక్టరీ", "directory", "షాపులు", "సర్వీసెస్", "services", "దుకాణాలు", "నంబర్లు"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "dir_list" },
    },
    {
      node_key: "dir_list",
      node_type: "send_list",
      config: {
        text: "📍 *చౌటుప్పల్ లోకల్ డైరెక్టరీ*\n\nమీకు అవసరమైన సర్వీస్ లేదా విభాగాన్ని క్రింది జాబితా నుండి ఎంచుకోండి:",
        button_label: "విభాగాలు చూడండి",
        header_text: "చౌటుప్పల్ సర్వీసెస్",
        footer_text: "🌐 https://choutuppal.in/directory",
        sections: [
          {
            title: "రవాణా & ప్రయాణం",
            rows: [
              {
                reply_id: "cat_auto",
                title: "ఆటో & క్యాబ్ స్టాండ్",
                description: "స్థానిక ఆటో డ్రైవర్లు, ప్రైవేట్ క్యాబ్‌లు",
                next_node_key: "dir_auto_details",
              },
            ],
          },
          {
            title: "షాపింగ్ & ఆహారం",
            rows: [
              {
                reply_id: "cat_shops",
                title: "కిరాణా & షాపులు",
                description: "కిరాణా దుకాణాలు, జనరల్ స్టోర్స్, బట్టలు",
                next_node_key: "dir_shops_details",
              },
              {
                reply_id: "cat_hotels",
                title: "హోటళ్ళు & రెస్టారెంట్లు",
                description: "టిఫిన్స్, భోజనం, టీ స్టాల్స్, ఫ్యామిలీ హోటల్స్",
                next_node_key: "dir_hotels_details",
              },
            ],
          },
          {
            title: "ఆరోగ్యం & సేవలు",
            rows: [
              {
                reply_id: "cat_medical",
                title: "డాక్టర్లు & మెడికల్",
                description: "హాస్పిటల్స్, క్లినిక్స్, 24 గంటల మెడికల్ షాపులు",
                next_node_key: "dir_medical_details",
              },
              {
                reply_id: "cat_services",
                title: "రిపేర్లు & టెక్నీషియన్లు",
                description: "ఎలక్ట్రీషియన్, ప్లంబర్, బైక్/కార్ మెకానిక్స్",
                next_node_key: "dir_services_details",
              },
            ],
          },
          {
            title: "ఇతర విభాగాలు",
            rows: [
              {
                reply_id: "cat_realestate",
                title: "రియల్ ఎస్టేట్",
                description: "ఓపెన్ ప్లాట్లు, పొలాలు, ఇళ్ళు & అద్దెలు",
                next_node_key: "dir_realestate_details",
              },
              {
                reply_id: "cat_jobs",
                title: "ఉద్యోగ సమాచారం",
                description: "స్థానిక ఫ్యాక్టరీలు, దుకాణాల్లో ఖాళీలు",
                next_node_key: "dir_jobs_details",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "dir_auto_details",
      node_type: "send_message",
      config: {
        text: "🛺 *ఆటో & క్యాబ్ సర్వీసెస్*\n\nచౌటుప్పల్ బస్టాండ్, హైవే మరియు కాలనీల్లో అందుబాటులో ఉన్న ఆటోల వివరాలు:\n\n🌐 పూర్తి లిస్ట్ కోసం: https://choutuppal.in/directory?cat=transport\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_shops_details",
      node_type: "send_message",
      config: {
        text: "🛍️ *కిరాణా & షాపుల వివరాలు*\n\nచౌటుప్పల్‌లోని ప్రముఖ రిటైల్ మరియు హోల్‌సేల్ వ్యాపారాలు:\n\n🌐 పూర్తి లిస్ట్ కోసం: https://choutuppal.in/directory?cat=shops\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_hotels_details",
      node_type: "send_message",
      config: {
        text: "🍽️ *హోటళ్ళు & రెస్టారెంట్లు*\n\nచౌటుప్పల్ హైవే మరియు పట్టణంలోని ఉత్తమ హోటళ్ళు, బిర్యానీ పాయింట్లు:\n\n🌐 పూర్తి లిస్ట్ కోసం: https://choutuppal.in/directory?cat=food\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_medical_details",
      node_type: "send_message",
      config: {
        text: "🏥 *ఆస్పత్రులు & మెడికల్ షాపులు*\n\nఅత్యవసర వైద్య సేవలు, డాక్టర్ల సమయాలు మరియు మెడికల్ స్టోర్స్:\n\n🌐 పూర్తి లిస్ట్ కోసం: https://choutuppal.in/directory?cat=medical\n\n📞 అత్యవసర హెల్ప్‌లైన్: 9441348175",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_services_details",
      node_type: "send_message",
      config: {
        text: "🔧 *రిపేర్లు & టెక్నీషియన్లు*\n\nఎలక్ట్రీషియన్లు, ప్లంబర్లు, ఏసీ మెకానిక్స్ మరియు కార్పెంటర్లు:\n\n🌐 పూర్తి లిస్ట్ కోసం: https://choutuppal.in/directory?cat=services\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_realestate_details",
      node_type: "send_message",
      config: {
        text: "🏡 *రియల్ ఎస్టేట్ వివరాలు*\n\nచౌటుప్పల్ పరిసర ప్రాంతాల్లో వెంచర్లు, ఓపెన్ ప్లాట్లు & ఇళ్ళు:\n\n🌐 రియల్ ఎస్టేట్ పోర్టల్: https://choutuppal.in/real-estate\n\n💡 మీ వెంచర్ ప్రమోషన్ల కోసం: 9441348175",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_jobs_details",
      node_type: "send_message",
      config: {
        text: "💼 *స్థానిక ఉద్యోగ సమాచారం*\n\nస్థానిక పరిశ్రమలు, ఫార్మా కంపెనీలు మరియు షాపుల్లో ఉద్యోగ ఖాళీలు:\n\n🌐 జాబ్స్ పోర్టల్: https://choutuppal.in/jobs\n\n💡 రిక్రూట్‌మెంట్ సమాచారం కోసం: 9441348175",
        next_node_key: "dir_followup",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "dir_followup",
      node_type: "send_buttons",
      config: {
        text: "మీకు మరింత సమాచారం లేదా హెల్ప్‌లైన్ సహాయం కావాలా?",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          { reply_id: "btn_dir_menu", title: "మరిన్ని సేవలు", next_node_key: "dir_list" },
          { reply_id: "btn_dir_help", title: "హెల్ప్‌లైన్", next_node_key: "dir_handoff" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "dir_handoff",
      node_type: "handoff",
      config: {
        note: "Customer requested helpline assistance from Local Directory.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 6. My Business (Vendor Portal & Promotion Gateway)
// ============================================================
const MY_BUSINESS: FlowTemplate = {
  slug: "my_business",
  name: "My Business",
  description: "స్థానిక వ్యాపార యజమానుల కోసం ప్రొఫైల్ మేనేజ్‌మెంట్, ఆఫర్లు & మార్కెటింగ్ సేవలు.",
  icon: "Store",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["వ్యాపారం", "business", "షాప్", "shop", "నా వ్యాపారం", "vendor", "store"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "biz_gateway" },
    },
    {
      node_key: "biz_gateway",
      node_type: "send_buttons",
      config: {
        text: "🏪 *చౌటుప్పల్ వ్యాపార కేంద్రం*\n\nమీ వ్యాపారాన్ని డైరెక్టరీలో సులభంగా నిర్వహించండి.\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?",
        footer_text: "🌐 https://choutuppal.in/business",
        buttons: [
          { reply_id: "btn_edit_details", title: "వివరాలు సవరణ", next_node_key: "biz_edit_name_prompt" },
          { reply_id: "btn_update_photos", title: "ఫోటోలు మార్పు", next_node_key: "biz_photo_prompt" },
          { reply_id: "btn_all_good", title: "సరిగ్గా ఉన్నాయి", next_node_key: "biz_confirmed" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "biz_edit_name_prompt",
      node_type: "collect_input",
      config: {
        prompt_text: "📝 *షాప్ పేరు సవరణ*\n\nదయచేసి మీ సరైన వ్యాపారం/షాప్ పేరును పంపండి:\n\n(మార్పు లేకపోతే 'Skip' అని పంపండి)",
        var_key: "vendor_updated_name",
        next_node_key: "biz_edit_address_prompt",
      },
    },
    {
      node_key: "biz_edit_address_prompt",
      node_type: "collect_input",
      config: {
        prompt_text: "📍 *చిరునామా సవరణ*\n\nదయచేసి మీ షాప్ నంబర్, రోడ్డు లేదా ఏరియా వివరాలు పంపండి:\n\n(మార్పు లేకపోతే 'Skip' అని పంపండి)",
        var_key: "vendor_updated_address",
        next_node_key: "biz_edit_services_prompt",
      },
    },
    {
      node_key: "biz_edit_services_prompt",
      node_type: "collect_input",
      config: {
        prompt_text: "🛠️ *సేవల వివరాలు*\n\nమీరు అందించే సేవలను కామాలతో (commas) వేరు చేసి పంపండి:\n(ఉదాహరణ: Wiring, Repairs, Inverter Fitting)\n\n(మార్పు లేకపోతే 'Skip' అని పంపండి)",
        var_key: "vendor_updated_services",
        next_node_key: "biz_update_submitted",
      },
    },
    {
      node_key: "biz_update_submitted",
      node_type: "send_message",
      config: {
        text: "✅ *వివరాలు స్వీకరించబడ్డాయి!*\n\nమీరు పంపిన సవరణలు రికార్డ్ చేయబడ్డాయి. మా డైరెక్టరీ టీమ్ పరిశీలించి త్వరలో అప్‌డేట్ చేస్తుంది.\n\nధన్యవాదాలు! 🙏\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.\n🌐 https://choutuppal.in",
        next_node_key: "biz_next_action",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "biz_photo_prompt",
      node_type: "send_message",
      config: {
        text: "📸 *బిజినెస్ ఫోటోలు*\n\nమీ షాప్ లేదా వర్క్ బోర్డు ఫోటోను మా హెల్ప్‌లైన్ నంబర్ 9441348175 కు WhatsApp చేయండి లేదా వెబ్‌సైట్ ద్వారా అప్‌లోడ్ చేయండి:\n\n🌐 https://choutuppal.in/vendor/photos\n\n💡 ప్రమోషన్ వివరాల కోసం: 9441348175",
        next_node_key: "biz_next_action",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "biz_confirmed",
      node_type: "send_message",
      config: {
        text: "🎉 *ధన్యవాదాలు!*\n\nమీ వ్యాపార వివరాలు సరిగ్గా ఉన్నాయని నిర్ధారించాం. చౌటుప్పల్ యాప్ ద్వారా మీ వ్యాపారానికి ఎల్లప్పుడూ సేవలు అందిస్తూ ఉంటాము.\n\n🌐 https://choutuppal.in/business\n💡 హెల్ప్‌లైన్: 9441348175",
        next_node_key: "biz_end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "biz_next_action",
      node_type: "send_buttons",
      config: {
        text: "మా సపోర్ట్ టీమ్‌తో మాట్లాడాలనుకుంటున్నారా లేదా మెయిన్ మెనూకి వెళ్లాలనుకుంటున్నారా?",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          { reply_id: "btn_contact_exec", title: "హెల్ప్‌లైన్", next_node_key: "biz_handoff" },
          { reply_id: "btn_main_menu", title: "మెయిన్ మెనూ", next_node_key: "biz_gateway" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "biz_handoff",
      node_type: "handoff",
      config: {
        note: "Vendor requested direct support from My Business portal.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "biz_end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 7. Premium Listing (Plans, Features & Lead Ingestion)
// ============================================================
const PREMIUM_LISTING: FlowTemplate = {
  slug: "premium_listing",
  name: "Premium Listing",
  description: "గోల్డ్ & సిల్వర్ ప్రీమియం మెంబర్‌షిప్ ప్లాన్స్ మరియు ప్రయోజనాలు.",
  icon: "Sparkles",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["ప్రీమియం", "premium", "గోల్డ్ ప్లాన్", "gold", "silver", "ప్లాన్స్", "లిస్టింగ్"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "prem_gateway" },
    },
    {
      node_key: "prem_gateway",
      node_type: "send_buttons",
      config: {
        text: "⭐ *చౌటుప్పల్ ప్రీమియం బిజినెస్ ప్లాన్స్*\n\nమీ షాప్ లేదా సర్వీస్ డైరెక్టరీలో టాప్ స్థానంలో కనిపించాలా? వెరిఫైడ్ బ్యాడ్జ్ మరియు ఎక్కువ కస్టమర్ కాల్స్ పొందండి!\n\nమీకు కావలసిన ప్లాన్ ఎంచుకోండి:",
        footer_text: "🌐 https://choutuppal.in/premium",
        buttons: [
          { reply_id: "btn_gold", title: "గోల్డ్ ప్లాన్", next_node_key: "prem_gold_details" },
          { reply_id: "btn_silver", title: "సిల్వర్ ప్లాన్", next_node_key: "prem_silver_details" },
          { reply_id: "btn_compare", title: "ప్లాన్ వివరాలు", next_node_key: "prem_compare_details" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "prem_gold_details",
      node_type: "send_message",
      config: {
        text: "🥇 *గోల్డ్ ప్లాన్ ఫీచర్లు:*\n\n• డైరెక్టరీలో నెం.1 స్థానం\n• గోల్డ్ వెరిఫైడ్ బ్యాడ్జ్ ⭐\n• నెలవారీ 2 ప్రమోషనల్ వీడియో రీల్స్\n• WhatsApp డైరెక్ట్ లీడ్ ఫార్వర్డింగ్\n• సోషల్ మీడియా పోస్టింగ్\n\n💡 మీ వ్యాపార వీడియో ప్రమోషన్ల కోసం 9441348175 ను సంప్రదించండి.\n🌐 https://choutuppal.in/premium/gold",
        next_node_key: "prem_ask_business_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "prem_silver_details",
      node_type: "send_message",
      config: {
        text: "🥈 *సిల్వర్ ప్లాన్ ఫీచర్లు:*\n\n• కేటగిరీలో టాప్ 5 స్థానం\n• సిల్వర్ వెరిఫైడ్ బ్యాడ్జ్\n• నెలకు 1 ప్రమోషనల్ పోస్టర్ డిజైన్\n• WhatsApp డైరెక్టరీ లిస్టింగ్\n\n💡 మీ వ్యాపార ప్రమోషన్ల కోసం 9441348175 ను సంప్రదించండి.\n🌐 https://choutuppal.in/premium/silver",
        next_node_key: "prem_ask_business_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "prem_compare_details",
      node_type: "send_message",
      config: {
        text: "📊 *ప్లాన్ పోలిక & ధరలు:*\n\nచౌటుప్పల్‌లో 25,000+ స్థానిక కస్టమర్లకు చేరువ కావడానికి ప్రీమియం ప్లాన్స్ ఎంతో ఉపయోగకరం.\n\nపూర్తి వివరాల కోసం మా వెబ్‌సైట్ చూడండి:\n🌐 https://choutuppal.in/premium",
        next_node_key: "prem_ask_business_name",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "prem_ask_business_name",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ వ్యాపారం లేదా షాప్ పేరు ఏమిటి?",
        var_key: "business_name",
        next_node_key: "prem_ask_phone",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "prem_ask_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "ధన్యవాదాలు! మా టీమ్ మిమ్మల్ని సంప్రదించడానికి మీ మొబైల్ నంబర్ తెలపండి:",
        var_key: "contact_phone",
        next_node_key: "prem_handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "prem_handoff",
      node_type: "handoff",
      config: {
        note: "Premium Listing Lead — Business: {{vars.business_name}}, Phone: {{vars.contact_phone}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 8. Promotion Services (Reels, Posters, WhatsApp Broadcasts)
// ============================================================
const PROMOTION_SERVICES: FlowTemplate = {
  slug: "promotion_services",
  name: "Promotion Services",
  description: "వీడియో రీల్స్, ప్రమోషనల్ పోస్టర్ డిజైన్స్ & WhatsApp మార్కెటింగ్ సేవలు.",
  icon: "Megaphone",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["ప్రమోషన్", "promotion", "రీల్స్", "reels", "వీడియో", "పోస్టర్", "poster", "మార్కెటింగ్"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "promo_intro" },
    },
    {
      node_key: "promo_intro",
      node_type: "send_buttons",
      config: {
        text: "🎬 *చౌటుప్పల్ డిజిటల్ ప్రమోషన్ సేవలు*\n\nమేము స్థానిక షాపులు మరియు సేవల కోసం ఆకర్షణీయమైన వీడియోలు & పోస్టర్లు తయారుచేస్తాము.\n\nమీకు కావలసిన సేవను ఎంచుకోండి:",
        footer_text: "🌐 https://choutuppal.in/promotions",
        buttons: [
          { reply_id: "btn_reels", title: "వీడియో రీల్స్", next_node_key: "promo_reels_info" },
          { reply_id: "btn_posters", title: "పోస్టర్ డిజైన్", next_node_key: "promo_posters_info" },
          { reply_id: "btn_wa_ads", title: "WhatsApp ప్రమోషన్", next_node_key: "promo_wa_info" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "promo_reels_info",
      node_type: "send_message",
      config: {
        text: "📱 *Instagram & Facebook రీల్స్ ప్రమోషన్*\n\n• హై-క్వాలిటీ షాప్ షూటింగ్ & వాయిస్ ఓవర్\n• 50,000+ స్థానిక వీక్షకులకు ప్రచారం\n• వైరల్ సోషల్ మీడియా రీల్స్ డిజైనింగ్\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.\n🌐 https://choutuppal.in/promotions/reels",
        next_node_key: "promo_ask_service_detail",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "promo_posters_info",
      node_type: "send_message",
      config: {
        text: "🎨 *ప్రొఫెషనల్ పోస్టర్ డిజైన్*\n\n• పండుగ శుభాకాంక్షలు & ఆఫర్ బ్యానర్లు\n• విజిటింగ్ కార్డులు & డిజిటల్ ఫ్లైయర్స్\n• ప్రింటింగ్ మరియు సోషల్ మీడియా సైజులలో\n\n💡 బుకింగ్స్ కోసం: 9441348175\n🌐 https://choutuppal.in/promotions/posters",
        next_node_key: "promo_ask_service_detail",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "promo_wa_info",
      node_type: "send_message",
      config: {
        text: "📢 *స్థానిక WhatsApp ప్రమోషన్*\n\n• చౌటుప్పల్ పరిసర ప్రాంతాల్లో టార్గెటెడ్ మెసేజింగ్\n• అధిక ఆఫర్ రెస్పాన్స్ & కాల్స్\n• అధికారిక WhatsApp Cloud API మార్కెటింగ్\n\n💡 వివరాల కోసం సంప్రదించండి: 9441348175\n🌐 https://choutuppal.in/promotions/whatsapp",
        next_node_key: "promo_ask_service_detail",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "promo_ask_service_detail",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ షాప్/సంస్థ పేరు మరియు ఏ రకమైన ప్రమోషన్ కావాలో క్లుప్తంగా తెలపండి:",
        var_key: "promo_requirement",
        next_node_key: "promo_handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "promo_handoff",
      node_type: "handoff",
      config: {
        note: "Promotion Enquiry — Requirement: {{vars.promo_requirement}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 9. Real Estate (Plots, Farmland, Houses & Listing Enquiries)
// ============================================================
const REAL_ESTATE: FlowTemplate = {
  slug: "real_estate",
  name: "Real Estate",
  description: "ఓపెన్ ప్లాట్లు, వ్యవసాయ భూములు, ఇళ్ళు మరియు ప్రాపర్టీ లిస్టింగ్ సేవలు.",
  icon: "Building2",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["రియల్ ఎస్టేట్", "plots", "real estate", "ప్లాట్లు", "భూమి", "ఇల్లు", "ఫ్లాట్", "lands"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "re_intro" },
    },
    {
      node_key: "re_intro",
      node_type: "send_buttons",
      config: {
        text: "🏡 *చౌటుప్పల్ రియల్ ఎస్టేట్ హబ్*\n\nచౌటుప్పల్, సంస్థాన్ నారాయణపురం మరియు హైవే పరిసర ప్రాంతాల్లోని ఉత్తమ ప్రాపర్టీ వివరాలు.\n\nమీ ఆసక్తి దేనిపై?",
        footer_text: "🌐 https://choutuppal.in/real-estate",
        buttons: [
          { reply_id: "btn_plots", title: "ఓపెన్ ప్లాట్లు", next_node_key: "re_plots_info" },
          { reply_id: "btn_farms", title: "వ్యవసాయ భూములు", next_node_key: "re_farms_info" },
          { reply_id: "btn_houses", title: "ఇళ్ళు/ఫ్లాట్లు", next_node_key: "re_houses_info" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "re_plots_info",
      node_type: "send_message",
      config: {
        text: "📐 *ఓపెన్ ప్లాట్లు (HMDA / DTCP)*\n\n• చౌటుప్పల్ హైవే మరియు రీజినల్ రింగ్ రోడ్ (RRR) సమీప వెంచర్లు\n• బ్యాంక్ లోన్ సౌకర్యం గల క్లియర్ టైటిల్ ప్లాట్లు\n\n🌐 అందుబాటులో ఉన్న వెంచర్లు: https://choutuppal.in/real-estate?type=plot\n\n💡 మీ వెంచర్ ప్రమోషన్ వీడియోల కోసం: 9441348175",
        next_node_key: "re_budget_inquiry",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "re_farms_info",
      node_type: "send_message",
      config: {
        text: "🌾 *వ్యవసాయ భూములు & ఫామ్‌ల్యాండ్స్*\n\n• అర ఎకరం నుండి పెద్ద విస్తీర్ణాల వరకు అనువైన భూములు\n• ఇన్వెస్ట్‌మెంట్ మరియు వ్యవసాయానికి అనువైన స్థలాలు\n\n🌐 వివరాలు: https://choutuppal.in/real-estate?type=farm\n\n💡 హెల్ప్‌లైన్: 9441348175",
        next_node_key: "re_budget_inquiry",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "re_houses_info",
      node_type: "send_message",
      config: {
        text: "🏠 *ఇండిపెండెంట్ ఇళ్ళు & అద్దెలు*\n\n• నూతన నిర్మాణాలు మరియు సెకండ్ హ్యాండ్ ఇళ్ళు\n• కమర్షియల్ షాపులు & అద్దె గృహాలు\n\n🌐 ప్రాపర్టీ లిస్ట్: https://choutuppal.in/real-estate?type=house\n\n💡 హెల్ప్‌లైన్: 9441348175",
        next_node_key: "re_budget_inquiry",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "re_budget_inquiry",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ పేరు మరియు మీ బడ్జెట్ లేదా ఆసక్తి ఉన్న ప్రాంతం తెలపండి:",
        var_key: "property_lead",
        next_node_key: "re_handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "re_handoff",
      node_type: "handoff",
      config: {
        note: "Real Estate Buyer Enquiry — Details: {{vars.property_lead}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 10. Jobs (Local Vacancies & Employer Postings)
// ============================================================
const JOBS: FlowTemplate = {
  slug: "jobs",
  name: "Jobs",
  description: "స్థానిక ఉద్యోగ సమాచారం, రిక్రూట్‌మెంట్ మరియు ఖాళీల ప్రకటనలు.",
  icon: "Briefcase",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["జాబ్స్", "jobs", "ఉద్యోగాలు", "ఉద్యోగం", "పని", "vacancy", "work"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "jobs_intro" },
    },
    {
      node_key: "jobs_intro",
      node_type: "send_buttons",
      config: {
        text: "💼 *చౌటుప్పల్ ఉద్యోగ సమాచార కేంద్రం*\n\nపరిశ్రమలు, షాపులు, పాఠశాలలు మరియు స్థానిక సంస్థలలో ఖాళీల వివరాలు.\n\nమీరు దేనికోసం చూస్తున్నారు?",
        footer_text: "🌐 https://choutuppal.in/jobs",
        buttons: [
          { reply_id: "btn_find_jobs", title: "ఖాళీలు చూడండి", next_node_key: "jobs_list_info" },
          { reply_id: "btn_post_job", title: "జాబ్ పోస్ట్ చేయండి", next_node_key: "jobs_post_info" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "jobs_list_info",
      node_type: "send_message",
      config: {
        text: "🔍 *తాజా ఉద్యోగ ఖాళీలు:*\n\n• ఫార్మా & పారిశ్రామిక ఉద్యోగాలు\n• సేల్స్ & బిల్లింగ్ స్టాఫ్\n• సెక్యూరిటీ, డ్రైవర్లు & హెల్పర్స్\n\nతాజా నోటిఫికేషన్లు చూడటానికి మా వెబ్‌సైట్ విజిట్ చేయండి:\n🌐 https://choutuppal.in/jobs\n\n💡 మీ వ్యాపార ప్రకటనల కోసం: 9441348175",
        next_node_key: "jobs_candidate_input",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "jobs_post_info",
      node_type: "send_message",
      config: {
        text: "📢 *ఉద్యోగ ప్రకటన ఇవ్వండి*\n\nమీ షాప్, ఫ్యాక్టరీ లేదా ఆఫీసులో ఉద్యోగులు కావాలా? చౌటుప్పల్ వేలాది అభ్యర్థులకు మీ ప్రకటన చేరవేయండి.\n\n🌐 రిక్రూటర్ పోర్టల్: https://choutuppal.in/jobs/post\n\n💡 నేరుగా పోస్ట్ చేయడానికి: 9441348175 ను సంప్రదించండి.",
        next_node_key: "jobs_candidate_input",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "jobs_candidate_input",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ పేరు, అర్హత (Qualification) మరియు ఫోన్ నంబర్ పంపండి:",
        var_key: "job_candidate_details",
        next_node_key: "jobs_handoff",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "jobs_handoff",
      node_type: "handoff",
      config: {
        note: "Job Seeker / Recruiter Submission — Details: {{vars.job_candidate_details}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 11. Service Catalog (Comprehensive Services Menu & Lead Capture)
// ============================================================
const SERVICE_CATALOG: FlowTemplate = {
  slug: "service_catalog",
  name: "Service Catalog",
  description: "చౌటుప్పల్ సమగ్ర సేవల కేటలాగ్: ప్రమోషన్స్, పోస్టర్లు, లోన్లు, ఇన్సూరెన్స్, ఆఫర్లు & WhatsApp బాట్స్.",
  icon: "Sparkles",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["కేటలాగ్", "catalog", "services menu", "సర్వీస్ కేటలాగ్", "all services"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "catalog_gateway" },
    },
    {
      node_key: "catalog_gateway",
      node_type: "send_buttons",
      config: {
        text: "✨ *చౌటుప్పల్ యాప్ సర్వీసెస్ కేటలాగ్*\n\nమా ద్వారా మీరు పొందగల ప్రముఖ వ్యాపార, డిజిటల్ మరియు ఆర్థిక సేవల వివరాలు.\n\nమీకు ఏ విభాగం సేవలు కావాలి?",
        footer_text: "🌐 https://choutuppal.in",
        buttons: [
          { reply_id: "btn_cat_marketing", title: "ప్రమోషన్ సేవలు", next_node_key: "cat_marketing_options" },
          { reply_id: "btn_cat_finance", title: "లోన్లు & భీమా", next_node_key: "cat_finance_options" },
          { reply_id: "btn_cat_more", title: "మరిన్ని సేవలు", next_node_key: "cat_more_services" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "cat_marketing_options",
      node_type: "send_buttons",
      config: {
        text: "📢 *ప్రమోషన్ & డిజిటల్ సేవలు*\n\n1. వీడియో రీల్స్ & షాప్ షూటింగ్\n2. పోస్టర్ డిజైన్ & శుభాకాంక్షలు\n3. WhatsApp ప్రమోషన్లు\n4. సోషల్ మీడియా యాడ్స్\n\nమీ ఆసక్తి దేనిపై?",
        footer_text: "🌐 https://choutuppal.in/promotions",
        buttons: [
          { reply_id: "btn_sub_reels", title: "వీడియో రీల్స్", next_node_key: "cat_video_inquiry" },
          { reply_id: "btn_sub_posters", title: "పోస్టర్ డిజైన్", next_node_key: "cat_poster_inquiry" },
          { reply_id: "btn_sub_wa_bot", title: "WhatsApp బాట్", next_node_key: "cat_wa_bot_inquiry" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "cat_finance_options",
      node_type: "send_buttons",
      config: {
        text: "💰 *ఆర్థిక & భీమా సమాచారం (Referral)*\n\nబ్యాంకు లోన్లు, క్రెడిట్ కార్డులు మరియు వెహికల్/హెల్త్ ఇన్సూరెన్స్ విచారణ సహాయం.\n\nమీకు కావలసినది ఎంచుకోండి:",
        footer_text: "💡 ఆమోదం సంబంధిత సంస్థ నిబంధనలపై ఆధారపడి ఉంటుంది.",
        buttons: [
          { reply_id: "btn_sub_loans", title: "బ్యాంక్ లోన్లు", next_node_key: "cat_loans_inquiry" },
          { reply_id: "btn_sub_insurance", title: "ఇన్సూరెన్స్", next_node_key: "cat_insurance_inquiry" },
          { reply_id: "btn_sub_deals", title: "స్థానిక ఆఫర్లు", next_node_key: "cat_deals_info" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "cat_more_services",
      node_type: "send_buttons",
      config: {
        text: "🌐 *ఇతర స్థానిక సేవలు & ఆఫర్లు*\n\n• స్థానిక షాపుల డిస్కౌంట్లు & కూపన్లు\n• సిఫార్సు చేయబడిన ఉపయోగకర ఉత్పత్తులు\n• ఎలక్ట్రీషియన్, ప్లంబర్ మొదలగు సర్వీసులు",
        footer_text: "🌐 https://choutuppal.in/services",
        buttons: [
          { reply_id: "btn_more_deals", title: "ఆఫర్లు & డీల్స్", next_node_key: "cat_deals_info" },
          { reply_id: "btn_more_automation", title: "బిజినెస్ బాట్", next_node_key: "cat_wa_bot_inquiry" },
          { reply_id: "btn_more_menu", title: "ప్రధాన మెనూ", next_node_key: "catalog_gateway" },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "cat_video_inquiry",
      node_type: "send_message",
      config: {
        text: "🎬 *వీడియో రీల్స్ & ప్రమోషన్*\n\nహై-క్వాలిటీ వీడియో రీల్స్, వాయిస్ ఓవర్ మరియు స్థానిక సోషల్ మీడియా ప్రచారం కోసం మీ వివరాలు సేకరిస్తున్నాము.\n\n💡 ప్రమోషన్ల కోసం: 9441348175\n🌐 https://choutuppal.in/promotions/reels",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_poster_inquiry",
      node_type: "send_message",
      config: {
        text: "🎨 *పోస్టర్ & క్రియేటివ్ డిజైన్*\n\nషాప్ ఆఫర్ పోస్టర్లు, పండుగ శుభాకాంక్షలు, బర్త్‌డే & ఈవెంట్ బ్యానర్ల డిజైనింగ్.\n\n💡 సంప్రదించండి: 9441348175\n🌐 https://choutuppal.in/promotions/posters",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_wa_bot_inquiry",
      node_type: "send_message",
      config: {
        text: "🤖 *వ్యాపార WhatsApp Bot / CRM*\n\nమీ షాప్ లేదా సర్వీస్ కోసం 24/7 ఆటోమేటెడ్ రిప్లైలు, క్యాటలాగ్ మరియు కస్టమర్ లీడ్ మేనేజ్‌మెంట్ సెటప్.\n\n🌐 వివరాలు: https://choutuppal.in/business/automation",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_loans_inquiry",
      node_type: "send_message",
      config: {
        text: "🏦 *రుణాల విచారణ (Loan Referral)*\n\nమీ అభ్యర్థనను సంబంధిత సేవా/రెఫరల్ ఛానల్కు పంపించవచ్చు.\nఆమోదం సంబంధిత సంస్థ నిబంధనలపై ఆధారపడి ఉంటుంది.\n\n(గమనిక: పాస్‌వర్డ్‌లు, OTPలు ఎవరికీ చెప్పవద్దు)",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_insurance_inquiry",
      node_type: "send_message",
      config: {
        text: "🛡️ *భీమా విచారణ (Insurance Enquiry)*\n\nబైక్, కారు, హెల్త్ మరియు లైఫ్ ఇన్సూరెన్స్ రెఫరల్ వివరాలు అందించబడతాయి.\n\n🌐 వివరాలు: https://choutuppal.in/services/insurance",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_deals_info",
      node_type: "send_message",
      config: {
        text: "🛒 *స్థానిక ఆఫర్లు & డీల్స్*\n\nచౌటుప్పల్ ప్రముఖ షాపులు మరియు ఆన్‌లైన్ బెస్ట్ డీల్స్ వివరాల కోసం మా పోర్టల్ చూడండి:\n\n🌐 https://choutuppal.in/deals",
        next_node_key: "cat_collect_requirement",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_collect_requirement",
      node_type: "collect_input",
      config: {
        prompt_text: "మీ పేరు, షాప్/విషయం మరియు మీకు కావలసిన నిర్దిష్ట అవసరాన్ని క్లుప్తంగా పంపండి:",
        var_key: "service_catalog_requirement",
        next_node_key: "cat_tag_lead",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "cat_tag_lead",
      node_type: "send_message",
      config: {
        text: "✅ *ధన్యవాదాలు! మీ అభ్యర్థన స్వీకరించబడింది.*\n\nమా ప్రతినిధి త్వరలోనే మీతో సంప్రదిస్తారు.\n\n💡 మీ షాప్ లేదా సర్వీస్ ప్రమోషన్ వీడియోల కోసం 9441348175 ను సంప్రదించండి.\n🌐 https://choutuppal.in",
        next_node_key: "cat_handoff",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "cat_handoff",
      node_type: "handoff",
      config: {
        note: "Service Catalog Enquiry — Details: {{vars.service_catalog_requirement}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  welcome_menu_v2: WELCOME_MENU_V2,
  local_directory: LOCAL_DIRECTORY,
  my_business: MY_BUSINESS,
  premium_listing: PREMIUM_LISTING,
  promotion_services: PROMOTION_SERVICES,
  real_estate: REAL_ESTATE,
  jobs: JOBS,
  service_catalog: SERVICE_CATALOG,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, slug)
    ? TEMPLATES[slug]
    : null;
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

  const cloned: FlowTemplate = JSON.parse(JSON.stringify(base));
  if (overrides.name !== undefined) cloned.name = overrides.name.trim();
  if (overrides.description !== undefined && overrides.description !== null) {
    cloned.description = overrides.description;
  }

  if (overrides.trigger_type !== undefined) {
    cloned.trigger_type = overrides.trigger_type;
    if (overrides.trigger_type !== base.trigger_type) cloned.trigger_config = {};
  }

  if (overrides.trigger_keywords !== undefined) {
    if (cloned.trigger_type !== "keyword") {
      throw new Error("trigger_keywords can only be applied to keyword flows.");
    }
    if (overrides.trigger_keywords.length === 0) {
      throw new Error("At least one trigger keyword is required.");
    }
    cloned.trigger_config = {
      keywords: [...overrides.trigger_keywords],
      match_type: "contains",
    };
  } else if (cloned.trigger_type === "keyword" && base.trigger_type !== "keyword") {
    throw new Error("trigger_keywords are required when changing a template to a keyword trigger.");
  }

  const startNode = cloned.nodes.find((node) => node.node_type === "start");
  let entryNodeKey =
    (startNode?.config as { next_node_key?: string })?.next_node_key ??
    cloned.entry_node_id;
  let entryNode = cloned.nodes.find((node) => node.node_key === entryNodeKey);

  // If the direct target from start is a passthrough/auto-advance node (e.g. send_contact),
  // walk forward to find the interactive/message node for initial_message and button_options overrides.
  if (entryNode && (entryNode.node_type === "send_contact" || entryNode.node_type === "send_media")) {
    const nextKey = (entryNode.config as { next_node_key?: string })?.next_node_key;
    const nextNode = cloned.nodes.find((node) => node.node_key === nextKey);
    if (nextNode) {
      entryNodeKey = nextKey!;
      entryNode = nextNode;
    }
  }

  if (overrides.initial_message !== undefined) {
    if (!entryNode) throw new Error("The template entry message node could not be found.");
    const config = entryNode.config as Record<string, unknown>;
    if (typeof config.text === "string") {
      config.text = overrides.initial_message;
    } else if (typeof config.prompt_text === "string") {
      config.prompt_text = overrides.initial_message;
    } else {
      throw new Error("The template entry node does not support a message override.");
    }
  }

  if (entryNode) {
    const config = entryNode.config as Record<string, unknown>;
    if (overrides.media_type) config.media_type = overrides.media_type;
    if (overrides.media_url) {
      config.media_url = overrides.media_url;
      if (overrides.media_type === "image") config.header_image_url = overrides.media_url;
    }
  }

  if (overrides.button_options !== undefined) {
    const titles = overrides.button_options;
    if (titles.length < 1 || titles.length > 3) {
      throw new Error("button_options must contain between 1 and 3 labels.");
    }
    if (titles.some((title) => !title.trim() || title.length > 20)) {
      throw new Error("Button labels must be non-empty and no longer than 20 characters.");
    }
    if (!entryNode || entryNode.node_type !== "send_buttons") {
      throw new Error("The template entry node does not support button overrides.");
    }

    const config = entryNode.config as SendButtonsNodeConfig;
    const existingButtons = config.buttons ?? [];
    const nodeKeys = new Set(cloned.nodes.map((node) => node.node_key));
    const updatedButtons = titles.map((title, index) => {
      const existing = existingButtons[index];
      if (existing) return { ...existing, title };

      let nodeKey = `csv_override_handoff_${index + 1}`;
      let suffix = 1;
      while (nodeKeys.has(nodeKey)) nodeKey = `csv_override_handoff_${index + 1}_${suffix++}`;
      nodeKeys.add(nodeKey);
      cloned.nodes.push({
        node_key: nodeKey,
        node_type: "handoff",
        config: { note: `Customer selected "${title}" from ${cloned.name}.` },
      });
      return {
        reply_id: `csv_override_button_${index + 1}`,
        title,
        next_node_key: nodeKey,
      };
    });

    config.buttons = updatedButtons;

    // Orphan protection: prune any nodes that became disconnected/unreachable from entry
    const reachable = reachableFromEntry(
      cloned.entry_node_id,
      cloned.nodes as unknown as Parameters<typeof reachableFromEntry>[1],
    );
    cloned.nodes = cloned.nodes.filter((node) => reachable.has(node.node_key));
  }

  return cloned;
}
