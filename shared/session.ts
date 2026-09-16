import type {
  AIResponse,
  SessionSnapshot,
  ThinkEvent,
} from "./types";

export function eventsThrough(
  events: ThinkEvent[],
  index: number
): ThinkEvent[] {
  if (index < 0) return [];
  return events.slice(0, index + 1);
}

export function responseToSnapshot(
  response: AIResponse,
  previous?: SessionSnapshot
): SessionSnapshot {
  return {
    understanding:
      response.understanding || previous?.understanding || "",
    reasoning:
      response.reasoning || previous?.reasoning || "",
    solution:
      response.solution || previous?.solution || "",
    nextStep:
      response.nextStep || previous?.nextStep || "",
    decisions:
      response.decisions?.length
        ? response.decisions
        : previous?.decisions || [],
    graph:
      response.graph || previous?.graph || { nodes: [], edges: [] },
    design:
      response.design ||
      previous?.design || {
        name: "",
        description: "",
        components: [],
      },
    prototype:
      response.prototype ||
      previous?.prototype || {
        name: "",
        productType: "",
        purpose: "",
        description: "",
        components: [],
        connections: [],
        interactions: [],
        environment: "",
        appearance: "",
        functionalFlow: [],
        assembly: [],
      },
  };
}
