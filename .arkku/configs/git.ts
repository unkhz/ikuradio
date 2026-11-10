import { join } from "node:path";
import type { GitDefinition } from "arkku";

export default {
  projectId: "song-that-never-ends",
  repositories: {
    "main": { url: "https://github.com/unkhz/song-that-never-ends.git", base: "main" },
  },
  getCheckoutPath({ name, repository }, api) {
    return join(api.projectDataDir, "checkouts", name, repository);
  },
  getBranch({ name }) { return `work/${name}`; },
  getCommitIdentity() { return {"name":"Juhani Pelli","email":"juhani.pelli@gmail.com","signing":{"type":"none"}}; },
} satisfies GitDefinition;
