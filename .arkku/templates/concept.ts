import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// A concept is a box on the Composer's map: something a Song is made of or by (the Mood, the Parts, the Score...).
// The record lives in a folder of its own, beside the module that gives its page's data (data.ts) and the script that
// draws it (view.js). Its band says where it stands on the map, and `leads` the concepts it leads into, by id,
// separated by commas. See plans/2026-11-21-evloution-of-song.md, steps 5 to 7.

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/composer/concepts/${input.slug}/concept.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only active concepts are on the map.",
      },
      band: {
        type: "string",
        enum: ["shapes", "edits", "made"],
        description: "Where it stands on the map: what shapes a Song, what the Composer edits, or what is made every Song.",
      },
      leads: {
        type: "string",
        default: "",
        description: "The ids of the concepts it leads into, separated by commas.",
      },
    },
    required: ["state", "band"],
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
    // a concept that may be on the map must have its data and its page's script
    const dir = `${root}packages/composer/concepts/${record.meta.slug}`;
    if (record.meta.state === "active") {
      for (const file of ["data.ts", "view.js"]) {
        if (!existsSync(`${dir}/${file}`)) throw new Error(`an active concept needs its ${file}: ${dir}/${file} is missing`);
      }
    }
  },
} satisfies TemplateDefinition;
