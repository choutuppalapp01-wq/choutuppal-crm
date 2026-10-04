/**
 * Flow Collision Detection Engine.
 *
 * Detects conflicts between a candidate flow (about to be activated or imported)
 * and existing active flows in the same account:
 * - Duplicate exact keywords
 * - Competing keyword triggers (overlapping contains-keywords)
 * - Competing first_inbound_message flows (only one active allowed per account)
 */

export interface FlowCollisionCandidate {
  id: string;
  name: string;
  trigger_type: "keyword" | "first_inbound_message" | "manual" | string;
  trigger_config?: Record<string, unknown> | null;
  status?: string;
}

export interface FlowCollision {
  conflictingFlowId: string;
  conflictingFlowName: string;
  triggerType: string;
  conflictKey: string;
  reason: string;
}

export function detectFlowCollisions(
  accountFlows: FlowCollisionCandidate[],
  targetFlow: FlowCollisionCandidate,
): FlowCollision[] {
  const collisions: FlowCollision[] = [];
  const seenCollisions = new Set<string>();

  // Compare only against other active flows in the account
  const otherActiveFlows = accountFlows.filter(
    (flow) =>
      flow.id !== targetFlow.id &&
      (flow.status === undefined || flow.status === "active"),
  );

  // 1. Conflicting first_inbound_message flows
  if (targetFlow.trigger_type === "first_inbound_message") {
    for (const flow of otherActiveFlows) {
      if (flow.trigger_type === "first_inbound_message") {
        const dedupeKey = `${flow.id}:first_inbound_message`;
        if (!seenCollisions.has(dedupeKey)) {
          seenCollisions.add(dedupeKey);
          collisions.push({
            conflictingFlowId: flow.id,
            conflictingFlowName: flow.name,
            triggerType: "first_inbound_message",
            conflictKey: "first_inbound_message",
            reason: `Competing first_inbound_message trigger: Flow "${flow.name}" is already active for first inbound messages.`,
          });
        }
      }
    }
  }

  // 2. Keyword trigger collisions
  if (targetFlow.trigger_type === "keyword") {
    const targetKeywords = extractKeywords(targetFlow.trigger_config);
    const targetMatchType =
      (targetFlow.trigger_config?.match_type as string) ?? "contains";
    const targetCaseSensitive = Boolean(
      targetFlow.trigger_config?.case_sensitive,
    );

    for (const flow of otherActiveFlows) {
      if (flow.trigger_type === "keyword") {
        const otherKeywords = extractKeywords(flow.trigger_config);
        const otherMatchType =
          (flow.trigger_config?.match_type as string) ?? "contains";
        const otherCaseSensitive = Boolean(
          flow.trigger_config?.case_sensitive,
        );

        for (const targetKw of targetKeywords) {
          const normTarget = targetCaseSensitive
            ? targetKw
            : targetKw.toLowerCase();

          for (const otherKw of otherKeywords) {
            const normOther = otherCaseSensitive
              ? otherKw
              : otherKw.toLowerCase();

            // A. Exact keyword match
            if (normTarget === normOther) {
              const dedupeKey = `${flow.id}:exact:${normTarget}`;
              if (!seenCollisions.has(dedupeKey)) {
                seenCollisions.add(dedupeKey);
                collisions.push({
                  conflictingFlowId: flow.id,
                  conflictingFlowName: flow.name,
                  triggerType: "keyword",
                  conflictKey: targetKw,
                  reason: `Duplicate keyword trigger "${targetKw}" conflicts with active flow "${flow.name}".`,
                });
              }
              break;
            }

            // B. Competing contains-keyword overlap
            if (
              targetMatchType === "contains" &&
              otherMatchType === "contains" &&
              (normTarget.includes(normOther) || normOther.includes(normTarget))
            ) {
              const dedupeKey = `${flow.id}:contains:${normTarget}:${normOther}`;
              if (!seenCollisions.has(dedupeKey)) {
                seenCollisions.add(dedupeKey);
                collisions.push({
                  conflictingFlowId: flow.id,
                  conflictingFlowName: flow.name,
                  triggerType: "keyword",
                  conflictKey: targetKw,
                  reason: `Competing contains-keyword trigger "${targetKw}" overlaps with "${otherKw}" in active flow "${flow.name}".`,
                });
              }
              break;
            }
          }
        }
      }
    }
  }

  return collisions;
}

function extractKeywords(cfg?: Record<string, unknown> | null): string[] {
  if (!cfg) return [];
  const raw = cfg.keywords;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => (typeof k === "string" ? k.trim() : ""))
    .filter((k): k is string => k.length > 0);
}
