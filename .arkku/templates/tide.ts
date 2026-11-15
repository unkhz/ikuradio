import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// A Tide moves one numeric setting of one Facet, in one part, slowly over
// many Songs, rising and falling by an envelope. The record lives in a folder
// of its own, beside the code that says what it moves and how: actions.ts,
// with the envelope's numbers (age, attack, hold, decay, min, max).
// See plans/2026-11-15-tides.md.

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/tides/${input.slug}/tide.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only active Tides move a setting. A new one stays a draft until it has been heard.",
      },
    },
    required: ["state"],
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
    // a Tide that moves anything must say what it moves, and how
    const actions = `${root}packages/tides/${record.meta.slug}/actions.ts`;
    if (record.meta.state === "active" && !existsSync(actions)) {
      throw new Error(`an active Tide needs its actions: ${actions} is missing`);
    }
  },
} satisfies TemplateDefinition;
