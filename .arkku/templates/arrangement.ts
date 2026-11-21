import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// An Arrangement says which parts a Song is made of, in what order, and the
// parameters each is given. The record lives in a folder of its own, beside its
// declaration: arrangement.json, checked by a schema made from the parts. An
// Arrangement's folder is its id, never reused and never removed once a Song
// has been made with it. See plans/2026-11-21-evloution-of-song.md.

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/parts/arrangements/${input.slug}/arrangement.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only an active Arrangement may be used to make a Song. A retired one is still read: the Songs made with it are kept for ever.",
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
    // an Arrangement that may be used must have its declaration
    const declaration = `${root}packages/parts/arrangements/${record.meta.slug}/arrangement.json`;
    if (record.meta.state === "active" && !existsSync(declaration)) {
      throw new Error(`an active Arrangement needs its declaration: ${declaration} is missing`);
    }
  },
} satisfies TemplateDefinition;
