import type { TemplateDefinition } from "arkku";

// An issue is an open question or a problem, raised instead of stopping to
// ask. The loop writes it down and carries on; the issue waits in
// issues/todo/ until it is talked through, and then it is done. Its state is
// its folder: when the state changes, `arkku record reconcile` moves it from
// issues/todo/ to issues/done/.
export default {
  getFilename(input) {
    return `issues/${input.meta.state}/${input.id}-${input.slug}.md`;
  },
  meta: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["todo", "done"],
        default: "todo",
        description: "todo while the question or problem is open; done once it has been answered or solved.",
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
  },
} satisfies TemplateDefinition;
