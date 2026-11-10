import { z } from 'zod'

const envSchema = z.object({
  OLLAMA_HOST: z.string().url().default('http://127.0.0.1:11434'),
  LYRICS_MODEL: z.string().default('qwen3:4b'),
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
