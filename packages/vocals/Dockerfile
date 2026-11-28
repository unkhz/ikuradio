# The Throat's live web playground (throat.ikurad.io): Chimera's full browser
# app built from the exact revision pinned in packages/vocals/lib/throat.ts,
# served by a minimal static binary on distroless nonroot.
#
#   docker build -f packages/vocals/Dockerfile .

FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl git \
 && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
  | sh -s -- -y --profile minimal --target wasm32-unknown-unknown
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /song
COPY packages/vocals/lib/throat.ts ./packages/vocals/lib/throat.ts
COPY packages/vocals/chimera.patch packages/vocals/throat-server.ts ./packages/vocals/

ARG RELEASE=dev
# Clone Chimera at the exact revision pinned by throat.ts and build its web app
RUN bun -e "import { repository, revision, throatName } from './packages/vocals/lib/throat.ts'; console.log(JSON.stringify({ repository, revision, throat: throatName(), release: process.env.RELEASE || 'dev' }))" > /tmp/throat.json \
 && REPO=$(bun -e "console.log(JSON.parse(await Bun.file('/tmp/throat.json').text()).repository)") \
 && REV=$(bun -e "console.log(JSON.parse(await Bun.file('/tmp/throat.json').text()).revision)") \
 && git init -q /chimera \
 && git -C /chimera fetch -q --depth 1 "$REPO" "$REV" \
 && git -C /chimera checkout -q --force --detach FETCH_HEAD \
 && cd /chimera \
 && bun install --frozen-lockfile \
 && bun run build \
 && cp /tmp/throat.json /chimera/dist/throat.json

# Compile the static file server into one standalone binary
RUN bun build packages/vocals/throat-server.ts \
      --compile \
      --minify \
      --compile-exec-argv=--smol \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --outfile /out/throat \
 && ldd /out/throat

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:9dac0a79194e45a7da0158a9c6da57b217585af0786db3845d1f0ec1a0dd182f
WORKDIR /srv
COPY --from=build /chimera/dist /srv/dist
COPY --from=build /out/throat /usr/local/bin/throat
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/throat"]
