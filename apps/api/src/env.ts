import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Orígenes permitidos para el frontend web, separados por comas.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas (revisa apps/api/.env):\n${problems}`);
  }
  return result.data;
}
