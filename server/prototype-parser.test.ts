import { describe, expect, it } from "vitest";
import { parseResponse } from "./routers";

const valid = {
  understanding: "A compact field sensor.", reasoning: "It needs a sealed enclosure and a sensing face.", solution: "A modular sensor node.", nextStep: "Validate the enclosure.", isOffTopic: false,
  offTopicReason: "", redirectQuestion: "", decisions: [], graph: { nodes: [], edges: [] }, design: { name: "Field node", description: "A sealed sensor.", components: ["sealed enclosure"] },
  prototype: {
    name: "Field node prototype", productType: "outdoor sensor", purpose: "Measure field conditions.", description: "A sealed node with a sensing face.",
    components: [{ id: "enclosure", name: "Sealed enclosure", role: "Protects the sensor electronics.", geometry: "box", dimensions: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], material: "steel", connections: [] }],
    connections: [], interactions: ["Sensor reads the environment."], environment: "outdoor field", appearance: "sealed engineering module", functionalFlow: ["sense", "process", "report"], assembly: ["Mount sensing face to enclosure."]
  }
};

describe("ThinkTrace ProtoSpec parser", () => {
  it("recovers JSON wrapped in explanation and markdown fences", () => {
    const result = parseResponse(`Here is the generated design:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
    expect(result.prototype.productType).toBe("outdoor sensor");
    expect(result.prototype.components[0]?.geometry).toBe("box");
  });

  it("fails loudly instead of inventing a replacement prototype", () => {
    expect(() => parseResponse("No prototype was generated")).toThrow(/JSON object/);
    expect(() => parseResponse(JSON.stringify({ ...valid, prototype: { ...valid.prototype, components: [] } }))).toThrow();
  });
});
