// SERVER ONLY. Never import this into a "use client" file — it exposes secrets.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  checkoutApiBase: required("CHECKOUT_API_URL").replace(/\/+$/, ""),
  callbackBaseUrl: required("CALLBACK_BASE_URL"),
  mongodbUri: required("MONGODB_URI"),
  mongodbDb: process.env.MONGODB_DB ?? "owambe_dinner",
  brevoApiKey: required("BREVO_API_KEY"),
  senderEmail: required("SENDER_EMAIL"),
  appSecret: required("QR_SECRET"),
  testCode: process.env.TEST_CODE ?? "ZAFMPPTTDOR",
  adminPassword: process.env.ADMIN_PASSWORD ?? "MEENSC123",
};