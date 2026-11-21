import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// A part is a piece of a Song: verse, chorus, bridge. The record lives in a
// folder of its own, beside the module that says what the part sings and how
// it counts: part.ts, whose default export is an instance of its subclass of
// Part. A part's folder is its id, never reused and never removed once a Song
// has been made with it. See plans/2026-11-21-evloution-of-song.md.

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/parts/${input.slug}/part.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only active parts may be put in an Arrangement. A retired part is still read: the Songs made with it are kept for ever.",
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
    // a part that may be used must have its module
    const module = `${root}packages/parts/${record.meta.slug}/part.ts`;
    if (record.meta.state === "active" && !existsSync(module)) {
      throw new Error(`an active part needs its module: ${module} is missing`);
    }
  },
} satisfies TemplateDefinition;
