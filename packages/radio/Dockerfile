# The Radio alone: it keeps the Tactus and points Receivers at the Archive.
# The Studio sings elsewhere, so nothing here makes a sound.
#
#   docker build -f packages/radio/Dockerfile .
#
# The Radio is compiled into one executable, the Receiver's page inside it,
# with Bun's low-memory mode (--smol) built in, and runs on nothing but the
# C libraries it needs: no shell, no package manager, no Bun to install.

FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS build
WORKDIR /song
COPY package.json bun.lock ./
COPY packages ./packages
# the critic's favourites, which an encore rotates, are read in at build
COPY critic ./critic
RUN bun install --frozen-lockfile --production
# the Receiver is built first, each file named by its hash, and the git hash
# the Radio is built from is stamped into it; the Radio tells it as its release
ARG RELEASE=dev
RUN RELEASE=${RELEASE} bun run receiver
RUN bun build packages/radio/index.ts \
      --compile \
      --minify \
      --sourcemap \
      --compile-exec-argv=--smol \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --outfile /out/radio \
 && mkdir -p /out/memory \
 && ldd /out/radio

FROM gcr.io/distroless/cc-debian12:nonroot@sha256:9dac0a79194e45a7da0158a9c6da57b217585af0786db3845d1f0ec1a0dd182f
# The Radio remembers what it announced in memory/, beside itself; in the
# cluster a volume is mounted there
WORKDIR /song/packages/radio
COPY --from=build --chown=1000:1000 /out/memory ./memory
COPY --from=build /out/radio /usr/local/bin/radio
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/radio"]
