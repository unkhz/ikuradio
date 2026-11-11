import { z } from 'zod'

const envSchema = z.object({
  /** Where the mind answers: llama.cpp's server. */
  MIND_HOST: z.string().url().default('http://127.0.0.1:8088'),
  /** The mind itself, a GGUF model on the song's shelf. */
  MIND_MODEL: z
    .string()
    .default(
      new URL('../../../models/mind.gguf', import.meta.url).pathname,
    ),
  /** How many tokens of context each of the mind's slots holds. */
  MIND_CONTEXT: z.coerce.number().int().min(512).default(3072),
  /** How many questions the mind answers at once. */
  MIND_SLOTS: z.coerce.number().int().min(1).default(5),
  SERVER_HOST: z.string().default('127.0.0.1'),
  /** Where the Radio answers Receivers. */
  SERVER_PORT: z.coerce.number().default(3000),
  /** The Archive's folder, while it is one. */
  ARCHIVE_DIR: z
    .string()
    .default(new URL('../../../archive/', import.meta.url).pathname),
  /** Where the Archive's file server answers, while it is a folder. */
  ARCHIVE_PORT: z.coerce.number().default(3001),
  /** Where the Radio reads the Archive from. */
  ARCHIVE_URL: z.string().url().default('http://127.0.0.1:3001/'),
  /**
   * The name the Radio is reached by from elsewhere, such as the dev box's
   * address on the home network. Only said aloud; the Radio listens everywhere.
   */
  RADIO_PUBLIC_HOST: z.string().min(1).optional(),
  /**
   * The name the Archive is reached by from elsewhere. The Radio sends
   * Receivers there. If not given, it uses whatever host each Receiver
   * reached the Radio at.
   */
  ARCHIVE_PUBLIC_HOST: z.string().min(1).optional(),
  /**
   * Where Receivers read the Archive from. If not given, the Radio tells
   * each Receiver the Archive's port on the host it reached the Radio at.
   */
  PUBLIC_ARCHIVE_URL: z.string().url().optional(),
  /** How many Songs the Studio keeps ready ahead of the one the Radio plays. */
  SONGS_AHEAD: z.coerce.number().int().min(1).default(2),
  /** How many iterations one Song lasts, all in the same Mood. */
  ITERATION_COUNT: z.coerce.number().int().min(1).default(4),
  /** How many descriptions are blended into one Mood. */
  MOOD_COUNT: z.coerce.number().int().min(1).default(2),
  /** How many voices sing the chorus, the lead included. */
  CHOIR_COUNT: z.coerce.number().int().min(1).max(4).default(3),
  VARIATION_COUNT: z.coerce.number().int().min(1).default(2),
})

export function getEnv(env = process.env) {
  return envSchema.parse(env)
}

export function getSingleEnv(
  key: keyof typeof envSchema.shape,
  env = process.env,
) {
  return envSchema.parse(env[key])
}
