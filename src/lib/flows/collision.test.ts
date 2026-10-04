import { describe, expect, it } from "vitest";
import {
  detectFlowCollisions,
  type FlowCollisionCandidate,
} from "./collision";

describe("detectFlowCollisions", () => {
  it("returns empty array when there are no collisions", () => {
    const activeFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Welcome Menu",
        trigger_type: "keyword",
        trigger_config: { keywords: ["menu", "start"] },
        status: "active",
      },
      {
        id: "flow-2",
        name: "Support Desk",
        trigger_type: "keyword",
        trigger_config: { keywords: ["help", "support"] },
        status: "active",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-3",
      name: "Pricing Info",
      trigger_type: "keyword",
      trigger_config: { keywords: ["pricing", "cost"] },
      status: "draft",
    };

    const collisions = detectFlowCollisions(activeFlows, targetFlow);
    expect(collisions).toEqual([]);
  });

  it("detects exact duplicate keywords case-insensitively", () => {
    const activeFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Main Welcome",
        trigger_type: "keyword",
        trigger_config: { keywords: ["Hi", "Hello"] },
        status: "active",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-2",
      name: "Secondary Greeting",
      trigger_type: "keyword",
      trigger_config: { keywords: ["hello", "namaste"] },
      status: "draft",
    };

    const collisions = detectFlowCollisions(activeFlows, targetFlow);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      conflictingFlowId: "flow-1",
      conflictingFlowName: "Main Welcome",
      triggerType: "keyword",
      conflictKey: "hello",
    });
    expect(collisions[0].reason).toContain("Duplicate keyword trigger");
  });

  it("detects competing contains-keywords between active flows", () => {
    const activeFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Order Flow",
        trigger_type: "keyword",
        trigger_config: { keywords: ["order"], match_type: "contains" },
        status: "active",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-2",
      name: "Order Status Flow",
      trigger_type: "keyword",
      trigger_config: { keywords: ["order status"], match_type: "contains" },
      status: "draft",
    };

    const collisions = detectFlowCollisions(activeFlows, targetFlow);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      conflictingFlowId: "flow-1",
      conflictingFlowName: "Order Flow",
      triggerType: "keyword",
      conflictKey: "order status",
    });
    expect(collisions[0].reason).toContain("Competing contains-keyword trigger");
  });

  it("detects competing first_inbound_message flows", () => {
    const activeFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Default First Inbound Bot",
        trigger_type: "first_inbound_message",
        status: "active",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-2",
      name: "New Lead Capture",
      trigger_type: "first_inbound_message",
      status: "draft",
    };

    const collisions = detectFlowCollisions(activeFlows, targetFlow);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      conflictingFlowId: "flow-1",
      conflictingFlowName: "Default First Inbound Bot",
      triggerType: "first_inbound_message",
      conflictKey: "first_inbound_message",
    });
    expect(collisions[0].reason).toContain("Competing first_inbound_message trigger");
  });

  it("ignores target flow comparing against itself during re-activation", () => {
    const activeFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Welcome Menu",
        trigger_type: "keyword",
        trigger_config: { keywords: ["hi", "hello"] },
        status: "active",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-1",
      name: "Welcome Menu",
      trigger_type: "keyword",
      trigger_config: { keywords: ["hi", "hello"] },
      status: "active",
    };

    const collisions = detectFlowCollisions(activeFlows, targetFlow);
    expect(collisions).toEqual([]);
  });

  it("ignores draft and archived flows in collision check", () => {
    const accountFlows: FlowCollisionCandidate[] = [
      {
        id: "flow-1",
        name: "Old Archived Welcome",
        trigger_type: "keyword",
        trigger_config: { keywords: ["hi"] },
        status: "archived",
      },
      {
        id: "flow-2",
        name: "Draft Welcome",
        trigger_type: "keyword",
        trigger_config: { keywords: ["hi"] },
        status: "draft",
      },
    ];

    const targetFlow: FlowCollisionCandidate = {
      id: "flow-3",
      name: "New Active Welcome",
      trigger_type: "keyword",
      trigger_config: { keywords: ["hi"] },
      status: "draft",
    };

    const collisions = detectFlowCollisions(accountFlows, targetFlow);
    expect(collisions).toEqual([]);
  });
});
