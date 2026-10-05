-- ============================================================
-- 043_add_send_contact_node_type.sql
--
-- Choutuppal CRM — Add native 'send_contact' node type to flows.
--
-- Adds:
--   1. 'send_contact' value to `flow_nodes.node_type` CHECK constraint.
--      Mirrors the drop-and-recreate pattern established in migration 016.
--      Node config lives in JSONB (SendContactNodeConfig) and is validated
--      by TypeScript types, validateFlowForActivation(), and Meta API handlers.
--
-- Invariants:
--   - Preserves all 11 existing node_type values.
--   - Idempotent: safe to re-run.
-- ============================================================

-- ============================================================
-- 1. flow_nodes.node_type — add 'send_contact'
-- ============================================================
ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'send_contact',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  ));
