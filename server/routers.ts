import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import type { AIResponse } from "@shared/types";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const vector = z.array(z.number()).length(3);
const prototypeGeometry = z.enum(["box", "cylinder", "sphere", "wheel", "tube", "panel", "cone", "torus", "capsule", "dish", "custom"]);
const graphNode = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["idea", "thought", "insight", "problem", "constraint", "decision", "solution", "component"]),
  detail: z.string(),
});
const graphEdge = z.object({ source: z.string(), target: z.string(), label: z.string() });
const component = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  geometry: prototypeGeometry,
  dimensions: vector,
  position: vector,
  rotation: vector,
  scale: vector,
  material: z.string(),
  connections: z.array(z.string()).default([]),
});
const protoConnection = z.object({ from: z.string(), to: z.string(), relationship: z.string() });

export const aiResponseSchema = z.object({
  understanding: z.string(),
  reasoning: z.string(),
  solution: z.string(),
  nextStep: z.string(),
  isOffTopic: z.boolean(),
  offTopicReason: z.string().default(""),
  redirectQuestion: z.string().default(""),
  decisions: z.array(z.object({ id: z.string(), decision: z.string(), reason: z.string() })).default([]),
  graph: z.object({ nodes: z.array(graphNode), edges: z.array(graphEdge) }),
  design: z.object({ name: z.string(), description: z.string(), components: z.array(z.string()) }),
  prototype: z.object({
    name: z.string(),
    productType: z.string().default("conceptual product system"),
    purpose: z.string().default("Visualize the current product idea."),
    description: z.string(),
    components: z.array(component).min(1),
    connections: z.array(protoConnection).default([]),
    interactions: z.array(z.string()).default([]),
    environment: z.string().default("studio presentation space"),
    appearance: z.string().default("clean engineered concept prototype"),
    functionalFlow: z.array(z.string()).default([]),
    assembly: z.array(z.string()).default([]),
  }),
});

const geometryValues = ["box", "cylinder", "sphere", "wheel", "tube", "panel", "cone", "torus", "capsule", "dish", "custom"];
function graphNodeToJson() {
  return { type: "object", additionalProperties: false, properties: { id: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["idea", "thought", "insight", "problem", "constraint", "decision", "solution", "component"] }, detail: { type: "string" } }, required: ["id", "label", "type", "detail"] };
}
function graphEdgeToJson() {
  return { type: "object", additionalProperties: false, properties: { source: { type: "string" }, target: { type: "string" }, label: { type: "string" } }, required: ["source", "target", "label"] };
}
function componentToJson() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" }, name: { type: "string" }, role: { type: "string" }, geometry: { type: "string", enum: geometryValues },
      dimensions: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }, position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
      rotation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }, scale: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
      material: { type: "string" }, connections: { type: "array", items: { type: "string" } },
    },
    required: ["id", "name", "role", "geometry", "dimensions", "position", "rotation", "scale", "material", "connections"],
  };
}

const aiJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    understanding: { type: "string" }, reasoning: { type: "string" }, solution: { type: "string" }, nextStep: { type: "string" }, isOffTopic: { type: "boolean" }, offTopicReason: { type: "string" }, redirectQuestion: { type: "string" },
    decisions: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, decision: { type: "string" }, reason: { type: "string" } }, required: ["id", "decision", "reason"] } },
    graph: { type: "object", additionalProperties: false, properties: { nodes: { type: "array", items: graphNodeToJson() }, edges: { type: "array", items: graphEdgeToJson() } }, required: ["nodes", "edges"] },
    design: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, description: { type: "string" }, components: { type: "array", items: { type: "string" } } }, required: ["name", "description", "components"] },
    prototype: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: "string" }, productType: { type: "string" }, purpose: { type: "string" }, description: { type: "string" }, components: { type: "array", minItems: 1, items: componentToJson() },
        connections: { type: "array", items: { type: "object", additionalProperties: false, properties: { from: { type: "string" }, to: { type: "string" }, relationship: { type: "string" } }, required: ["from", "to", "relationship"] } },
        interactions: { type: "array", items: { type: "string" } }, environment: { type: "string" }, appearance: { type: "string" }, functionalFlow: { type: "array", items: { type: "string" } }, assembly: { type: "array", items: { type: "string" } },
      },
      required: ["name", "productType", "purpose", "description", "components", "connections", "interactions", "environment", "appearance", "functionalFlow", "assembly"],
    },
  },
  required: ["understanding", "reasoning", "solution", "nextStep", "isOffTopic", "offTopicReason", "redirectQuestion", "decisions", "graph", "design", "prototype"],
} as const;

const analyzeInput = z.object({
  originalIdea: z.string().min(3), currentThought: z.string().min(1), mode: z.enum(["solo", "team"]),
  previousEvents: z.array(z.object({ author: z.string(), content: z.string(), timestamp: z.string(), aiResponse: aiResponseSchema.optional() })).max(30),
});

const prompt = `You are the reasoning engine inside ThinkTrace, an AI thinking workspace. The original idea and every prior thought are the source of truth.

Return ONLY JSON matching the supplied schema. Do not use markdown. Be specific to this product; never invent a generic answer. The graph must be a complete current graph with stable ids where possible and real relationships.

The prototype field is a structured ProtoSpec, not decorative metadata. First infer what kind of product, device, system, environment, or physical interaction the user is describing. Then identify the important concepts and turn them into meaningful 3D components. Each component must correspond to an actual concept from the current idea/design and must use geometry, dimensions, position, rotation, scale, material, and connections that make a recognizable conceptual assembly. Use geometry that fits the concept: wheels for wheels, panels for screens, cylinders for dispensers or housings, torus for rings, dishes for antennas, capsules for handles, and boxes only when the concept is genuinely box-like. Do not use a generic box as the whole prototype. Do not use hardcoded bicycles, helmets, medicine dispensers, or any fixed category. A completely new reasonable idea must create a different semantic assembly.

ProtoSpec requirements: productType, purpose, descriptive components, explicit connections, interactions, environment, appearance, and functionalFlow. The 3D scene must visibly communicate the current product and change when the design changes. If a thought is off-topic, preserve the prior graph, design, and full ProtoSpec exactly and explain the redirect. Otherwise evolve the ProtoSpec only as the design meaningfully changes.

Use compact world coordinates centered near the origin. Component positions must be spatially meaningful and connections must reference component ids. Include a concise rationale in component roles and decisions. Think like an industrial designer and systems engineer, not a random primitive generator.`;

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => typeof part === "string" ? part : (part as { text?: string }).text ?? "").join("\n");
  return "";
}

/** Extract JSON even if a provider wraps it in fences or a short explanation. Never fabricates a response. */
export function parseResponse(raw: string): AIResponse {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("AI response did not contain a JSON object");
  const parsed: unknown = JSON.parse(cleaned.slice(first, last + 1));
  return aiResponseSchema.parse(parsed) as AIResponse;
}

async function runReasoning(input: z.infer<typeof analyzeInput>): Promise<AIResponse> {
  const prior = input.previousEvents.map(event => ({
    author: event.author, thought: event.content, timestamp: event.timestamp,
    ai: event.aiResponse ? { understanding: event.aiResponse.understanding, reasoning: event.aiResponse.reasoning, solution: event.aiResponse.solution, nextStep: event.aiResponse.nextStep, isOffTopic: event.aiResponse.isOffTopic, decisions: event.aiResponse.decisions, design: event.aiResponse.design, prototype: event.aiResponse.prototype } : null,
  }));
  const userPayload = JSON.stringify({ originalIdea: input.originalIdea, currentThought: input.currentThought, mode: input.mode, previousEvents: prior, currentProtoSpec: input.previousEvents.at(-1)?.aiResponse?.prototype ?? null });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await invokeLLM({ messages: [{ role: "system", content: prompt }, { role: "user", content: userPayload }], response_format: { type: "json_schema", json_schema: { name: "thinktrace_reasoning", strict: true, schema: aiJsonSchema } }, max_tokens: 3400, reasoning: { effort: "low" } });
      return parseResponse(contentToText(response.choices[0]?.message?.content));
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("AI response could not be parsed");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  thinktrace: router({
    analyze: publicProcedure.input(analyzeInput).mutation(async ({ input }) => {
      try { return { ok: true as const, response: await runReasoning(input) }; }
      catch (error) { console.error("[ThinkTrace] AI unavailable:", error); return { ok: false as const, error: "AI prototype generation failed validation — please retry." }; }
    }),
  }),
});

export type AppRouter = typeof appRouter;
