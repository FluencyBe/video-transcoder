function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 3100),
    r2: {
      bucket: required('R2_BUCKET'),
      accountId: required('R2_ACCOUNT_ID'),
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
    callbackUrl: required('TRANSCODE_CALLBACK_URL'),
    callbackToken: required('TRANSCODE_CALLBACK_TOKEN'),
  };
}
