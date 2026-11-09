import { z } from 'zod'

const envSchema = z.object({
  OLLAMA_HOST: z.string().url().default('http://127.0.0.1:11434'),
  LYRICS_MODEL: z.string().default('qwen3:4b'),
  SERVER_HOST: z.string(),
  SERVER_PORT: z.coerce.number(),
  SINGER: z.enum(['male', 'female', 'child']).default('female'),
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
