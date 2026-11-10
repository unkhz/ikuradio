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
  MIND_CONTEXT: z.coerce.number().int().min(512).default(2048),
  /** How many questions the mind answers at once. */
  MIND_SLOTS: z.coerce.number().int().min(1).default(5),
  SERVER_HOST: z.string().default('127.0.0.1'),
  SERVER_PORT: z.coerce.number().default(3000),
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
