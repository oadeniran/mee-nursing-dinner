// SERVER ONLY. Never import this into a "use client" file — it exposes secrets.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  checkoutApiUrl: required("CHECKOUT_API_URL"),
  callbackBaseUrl: required("CALLBACK_BASE_URL"),
  mongodbUri: required("MONGODB_URI"),
  mongodbDb: process.env.MONGODB_DB ?? "owambe_dinner",
};