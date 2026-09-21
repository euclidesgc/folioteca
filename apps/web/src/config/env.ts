import * as z from 'zod';

const EnvSchema = z.object({
  API_URL: z.string().min(1).default('/api'),
  ENABLE_API_MOCKING: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

const createEnv = (): z.infer<typeof EnvSchema> => {
  // VITE_APP_API_URL becomes API_URL.
  const envVars = Object.fromEntries(
    Object.entries(import.meta.env)
      .filter(([key]) => key.startsWith('VITE_APP_'))
      .map(([key, value]) => [key.replace('VITE_APP_', ''), value]),
  );

  const parsedEnv = EnvSchema.safeParse(envVars);

  if (!parsedEnv.success) {
    const problems = parsedEnv.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Fails at startup, not in the middle of a request.
    throw new Error(
      `Invalid env provided. Missing or invalid variables:\n${problems}`,
    );
  }

  return parsedEnv.data;
};

export const env = createEnv();
