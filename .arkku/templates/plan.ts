import type { TemplateDefinition } from "arkku";

// A plan is where the song is going: a dated page in plans/, written by hand.
// The date is stored, so the filename never drifts when a record is reconciled.
export default {
  getFilename(input, api) {
    return `plans/${input.meta.date}-${input.slug}.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["draft", "active", "done"],
        default: "draft",
      },
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "The day the plan was begun, YYYY-MM-DD.",
      },
    },
    required: ["state", "date"],
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
  },
} satisfies TemplateDefinition;
