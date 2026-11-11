# The Radio alone: it keeps the Tactus and points Receivers at the Archive.
# The Studio sings elsewhere, so nothing here makes a sound.
#
#   docker build -f packages/radio/Dockerfile .

FROM oven/bun:1.4.4-slim

WORKDIR /song
COPY package.json bun.lock ./
COPY packages ./packages
RUN bun install --frozen-lockfile --production

# The Radio remembers what it announced in memory/, beside itself
WORKDIR /song/packages/radio
RUN mkdir memory && chown bun:bun memory
USER bun
EXPOSE 3000
CMD ["bun", "index.ts"]
