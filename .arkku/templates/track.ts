import type { TemplateDefinition } from "arkku";
import { existsSync } from "node:fs";

// A Track is a lane of an Arrangement's timeline, one for each kind of thing that sounds: the voice, the bed, the guide. The
// record lives in a folder of its own, beside the module that says what its Blocks are made from and by what: track.ts, whose
// default export is an instance of its subclass of Track. A Track's folder is its id, never reused and never removed once a Song
// has been made with it. See plans/2026-11-21-evloution-of-song.md, "The Arrangement as a timeline".

/** The project's root, from this module: .arkku/templates/ is two folders down. */
const root = new URL("../../", import.meta.url).pathname;

export default {
  getFilename(input) {
    return `packages/parts/tracks/${input.slug}/track.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "retired"],
        default: "draft",
        description: "Only an active Track may have Blocks put on it. A retired Track is still read: the Songs made with it are kept for ever.",
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
    // a Track that may be used must have its module
    const module = `${root}packages/parts/tracks/${record.meta.slug}/track.ts`;
    if (record.meta.state === "active" && !existsSync(module)) {
      throw new Error(`an active Track needs its module: ${module} is missing`);
    }
  },
} satisfies TemplateDefinition;
