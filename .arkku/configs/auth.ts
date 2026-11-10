import { homedir } from "node:os";
import { join } from "node:path";
import type { AuthDefinition } from "arkku";

// The song's credentials live in the local OpenBao, handed out only inside supervised sessions.
export default {
  projectId: "song-that-never-ends",
  address: "https://127.0.0.1:8200",
  caFile: join(homedir(), ".config/openbao/tls/ca.pem"),
  setupCredential: { service: "openbao", name: "local-initialization", field: "root_token" },
  periodSeconds: 900,
  credentials: { git: { type: "github-pat" } },
} satisfies AuthDefinition;
