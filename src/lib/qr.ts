import QRCode from "qrcode";
import { env } from "./env";
import { signId } from "./security";

// Phase 3 will build /checkin/<id>; the sig makes the QR tamper-proof.
export function checkinUrl(orderId: string): string {
  return `${env.callbackBaseUrl}/checkin/${orderId}?sig=${signId(orderId)}`;
}

export async function generateQrDataUrl(orderId: string): Promise<string> {
  return QRCode.toDataURL(checkinUrl(orderId), {
    width: 320,
    margin: 2,
    color: { dark: "#2e1a12", light: "#fbf3e4" },
  });
}