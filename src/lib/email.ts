import { env } from "./env";

export async function sendOtpEmail(to: string, code: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "ÀJỌYỌ̀ Royale", email: env.senderEmail },
      to: [{ email: to }],
      subject: "Your ÀJỌYỌ̀ Royale Dinner verification code",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;background:#2e1a12;color:#fbf3e4;border-radius:14px;text-align:center">
          <h2 style="color:#e6c34d;margin:0 0 8px">ÀJỌYỌ̀ Royale</h2>
          <p style="margin:0 0 20px;color:#f5e9ce">Your verification code is:</p>
          <div style="font-size:34px;letter-spacing:8px;font-weight:700;color:#e6c34d">${code}</div>
          <p style="margin:20px 0 0;font-size:13px;color:#cdbfa6">Expires in 10 minutes. If you didn't request this, ignore it.</p>
        </div>`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}