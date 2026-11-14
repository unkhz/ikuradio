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
  /** Where the Radio answers Receivers, inside its home. */
  SERVER_PORT: z.coerce.number().default(3000),
  /** The live Radio: where the Heart and the terminal listen for the Tactus. */
  RADIO_URL: z.string().url().default('https://ikurad.io/'),
  /**
   * The Archive's bucket, by its public, path-style address
   * (https://<host>/<bucket>). The Studio publishes there, with its keys;
   * the Radio and Receivers read from there, with none.
   */
  ARCHIVE_PUBLIC_URL: z.string().url().optional(),
  /** The keys the Studio writes to the bucket with. Nothing else needs them. */
  ARCHIVE_ACCESS_KEY: z.string().min(1).optional(),
  ARCHIVE_SECRET_KEY: z.string().min(1).optional(),
  /** Where the Radio reads the Archive from, if not from the bucket's public address. */
  ARCHIVE_URL: z.string().url().optional(),
  /** Where the Radio sends Receivers for the Archive, if not where it reads it from. */
  PUBLIC_ARCHIVE_URL: z.string().url().optional(),
  /**
   * Where the Radio keeps its cache of the Songs received, for searching
   * them: a SQLite file that may be lost at any moment, and is filled again
   * from the Tactus and the Archive. Without it, the cache is kept in memory.
   */
  CACHE_PATH: z.string().default(':memory:'),
  /** How many Songs the Studio keeps ready ahead of the one the Radio plays. */
  SONGS_AHEAD: z.coerce.number().int().min(1).default(2),
  /** How many iterations one Song lasts, all in the same Mood. */
  ITERATION_COUNT: z.coerce.number().int().min(1).default(2),
  /** How many descriptions are blended into one Mood. */
  MOOD_COUNT: z.coerce.number().int().min(1).default(2),
  /** How many voices sing the chorus, the lead included. */
  CHOIR_COUNT: z.coerce.number().int().min(1).max(4).default(3),
  /**
   * How many syllables a voice may sing in a second, at most: no sung
   * syllable starts sooner than 1 / this after the one before. English is
   * spoken at about six; tuned by ear, from the next Song on.
   */
  SYLLABLES_PER_SECOND: z.coerce.number().min(1).max(12).default(6),
  VARIATION_COUNT: z.coerce.number().int().min(1).default(2),
  /**
   * How far the melody writer roams among the lines that keep its rules:
   * at 0 it always sings the cheapest, at 1 it samples them, the cheaper the
   * likelier. Only with the two-voice guide.
   */
  MELODY_SPRINKLE: z.coerce.number().min(0).max(4).default(1),
  /** How strongly last iteration's melody pulls at the contour of the one written now. */
  MELODY_GUIDE: z.coerce.number().min(0).max(4).default(1),
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
