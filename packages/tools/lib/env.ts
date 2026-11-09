import { z } from 'zod'

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(32),
  SERVER_HOST: z.string(),
  SERVER_PORT: z.coerce.number(),
  SINGER: z.enum(['male', 'female', 'child']).default('female'),
})

export function getEnv(env = process.env) {
  return envSchema.parse(env)
}

export function getSingleEnv(
  key: keyof typeof envSchema.shape,
  env = process.env
) {
  return envSchema.parse(env[key])
}
