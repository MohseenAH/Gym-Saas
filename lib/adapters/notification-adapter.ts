// Third-Party Provider Integration Layer: Notification Adapters

export interface NotificationPayload {
  recipientPhone: string;
  recipientEmail?: string;
  recipientName: string;
  subject?: string;
  message: string;
}

export interface NotificationProvider {
  name: string;
  sendNotice(payload: NotificationPayload): Promise<{ success: boolean; directUrl?: string }>;
  sendReceipt(payload: NotificationPayload & { receiptAmount: number; receiptId: string }): Promise<{ success: boolean; directUrl?: string }>;
}

// 1. WhatsApp Direct Web Link Adapter ($0 Cost - Opens WhatsApp on mobile/desktop without API subscription)
export class WhatsAppLinkAdapter implements NotificationProvider {
  name = "whatsapp_direct";

  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    // Default to India country code 91 if 10-digit number is provided
    if (digits.length === 10) {
      return `91${digits}`;
    }
    return digits;
  }

  async sendNotice(payload: NotificationPayload): Promise<{ success: boolean; directUrl: string }> {
    const phone = this.cleanPhone(payload.recipientPhone);
    const text = encodeURIComponent(
      `📢 *Notice from Gym Management*\n\nHello ${payload.recipientName},\n\n${payload.message}`
    );
    const directUrl = `https://wa.me/${phone}?text=${text}`;
    return { success: true, directUrl };
  }

  async sendReceipt(
    payload: NotificationPayload & { receiptAmount: number; receiptId: string }
  ): Promise<{ success: boolean; directUrl: string }> {
    const phone = this.cleanPhone(payload.recipientPhone);
    const text = encodeURIComponent(
      `🧾 *Gym Payment Receipt*\n\nHello ${payload.recipientName},\nPayment of ₹${payload.receiptAmount.toFixed(2)} received successfully.\nReceipt No: #${payload.receiptId.slice(0, 8)}\n\nThank you for being part of our fitness family!`
    );
    const directUrl = `https://wa.me/${phone}?text=${text}`;
    return { success: true, directUrl };
  }
}

export function getNotificationAdapter(): NotificationProvider {
  return new WhatsAppLinkAdapter();
}
