import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// A Perspective is one way a Song is heard differently from the usual: a
// Facet of the Studio's work it changes, the Turn it gives it, and how
// likely it is to be chosen (its weight; the more drastic, the lighter).
// The record lives in a folder of its own, beside the code that applies it:
// actions.ts (the Turn) and, if the Turn needs words for a model, prompts.json.
// See plans/2026-11-13-perspectives.md.

/** The Facets that have a hook in the Studio. Keep in step with packages/perspectives/lib/facets.ts. */
const facets = ["development", "choir", "humanness", "bridge-singers", "bridge-beds", "drift"];

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/perspectives/${input.slug}/perspective.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only active Perspectives are chosen for a Song. A new one stays a draft until it has been heard.",
      },
      facet: {
        type: "string",
        enum: facets,
        description: "The part of the Studio's work this Perspective changes: one hook in the code.",
      },
      weight: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "How likely it is to be chosen, from 1 (rare, drastic) to 10 (common, gentle).",
      },
    },
    required: ["state", "facet", "weight"],
    additionalProperties: false,
  },

  createRecord(input, api) {
    return api.createBody(input, `# ${input.title}\n`);
  },

  deriveMeta(body, api) {
    return api.deriveMeta(body);
  },

  validateRecord(record, api) {
    api.validateRecord(record);
    // a Perspective that may be chosen must have its Turn
    const actions = `${root}packages/perspectives/${record.meta.slug}/actions.ts`;
    if (record.meta.state === "active" && !existsSync(actions)) {
      throw new Error(`an active Perspective needs its Turn: ${actions} is missing`);
    }
  },
} satisfies TemplateDefinition;
