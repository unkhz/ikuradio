# A body for the song: everything it needs to sing, on any machine that can
# run a container. The mind that writes the words lives elsewhere, behind
# OLLAMA_HOST; the old music clips are not carried along, so the song sings
# unaccompanied until its Music is given a machine of its own.
#
#   task container:build
#   task container:run
#
# The diary lives in a volume, so the song remembers where it was when the
# container is replaced. If the song ever falls, the container is started
# again, and the song wakes where its diary says it was.

# The throat, built from its pinned revision. It looks for its pronouncing
# dictionary next to its own sources, so it is built where the song keeps it.
FROM rust:1.94-bookworm AS throat
ARG CHIMERA_REV=c24945a34296f1cd06c029fd283c43b2a0cc2c26
ARG CHIMERA_REPO=https://github.com/jamesondh/chimera-vocal-synth
WORKDIR /song/packages/vocals/.chimera
RUN git init -q . \
 && git fetch -q --depth 1 "$CHIMERA_REPO" "$CHIMERA_REV" \
 && git checkout -q --detach FETCH_HEAD
RUN cargo build --release --quiet -p chimera-cli

# The rest of the body: Node for the song, ffmpeg for the recordings.
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /song
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
COPY --from=throat /song/packages/vocals/.chimera/target/release/chimera packages/vocals/.chimera/target/release/chimera
COPY --from=throat /song/packages/vocals/.chimera/public/data packages/vocals/.chimera/public/data
# the throat finds its dictionary through its own crate's folder, so the folder must exist
RUN mkdir -p packages/vocals/.chimera/crates/chimera-cli \
    packages/server/memory packages/server/audio \
 && chown -R node:node packages/server

USER node
WORKDIR /song/packages/server
ENV SERVER_PORT=3000 \
    OLLAMA_HOST=http://host.docker.internal:11434
VOLUME /song/packages/server/memory
EXPOSE 3000
# The body asks the song for its pulse every minute. A song that is waking
# or holding a long fermata is still healthy; one that has missed its beat
# for a quarter of an hour is not.
HEALTHCHECK --interval=1m --timeout=10s --start-period=15m --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.SERVER_PORT}/pulse`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["./node_modules/.bin/tsx", "index.ts"]
