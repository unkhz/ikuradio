# The Radio alone: it keeps the Tactus and points Receivers at the Archive.
# The Studio sings elsewhere, so nothing here makes a sound.
#
#   docker build -f packages/radio/Dockerfile .
#
# The Radio is compiled into one executable, the Receiver's page inside it,
# with Bun's low-memory mode (--smol) built in. It runs on a slim Debian with
# sqlite3 beside it, so its log can be read where it lies:
#
#   kubectl -n apps exec -it deploy/ikuradio-radio -- sqlite3 log/radio.db

FROM oven/bun:1.4.4 AS build
WORKDIR /song
COPY package.json bun.lock ./
COPY packages ./packages
RUN bun install --frozen-lockfile --production
RUN bun build packages/radio/index.ts \
      --compile \
      --minify \
      --sourcemap \
      --compile-exec-argv=--smol \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --outfile /out/radio \
 && mkdir -p /out/memory /out/log \
 && ldd /out/radio

FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
# certificates to reach the Archive, and sqlite3 to read the log by hand
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates sqlite3 \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1000 radio \
 && useradd --uid 1000 --gid 1000 --no-create-home --shell /usr/sbin/nologin radio
# The Radio remembers what it announced in memory/, and writes its log in
# log/, beside itself; in the cluster a volume is mounted at each
WORKDIR /song/packages/radio
COPY --from=build --chown=1000:1000 /out/memory ./memory
COPY --from=build --chown=1000:1000 /out/log ./log
COPY --from=build /out/radio /usr/local/bin/radio
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/radio"]
