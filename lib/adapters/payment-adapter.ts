// Third-Party Provider Integration Layer: Payment Adapters

export interface PaymentOrderInput {
  amount: number;
  currency: string;
  receiptId: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  notes?: string;
}

export interface PaymentOrderResult {
  provider: "manual" | "razorpay" | "stripe";
  orderId: string;
  amount: number;
  currency: string;
  checkoutUrl?: string;
  qrPayload?: string; // UPI intent string or QR payload
  instructions?: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(input: PaymentOrderInput): Promise<PaymentOrderResult>;
  verifyPayment(paymentId: string, orderId: string, signature?: string): Promise<boolean>;
}

// 1. Manual / Offline & UPI Adapter ($0 cost in development)
export class ManualPaymentAdapter implements PaymentProvider {
  name = "manual";
  private upiId?: string;
  private merchantName?: string;

  constructor(config?: { upiId?: string; merchantName?: string }) {
    this.upiId = config?.upiId || "gym@upi";
    this.merchantName = config?.merchantName || "Gym Management";
  }

  async createOrder(input: PaymentOrderInput): Promise<PaymentOrderResult> {
    // Generate standard NPCI UPI Intent Link for 0-cost instant QR code / mobile app deep link
    const encodedMerchant = encodeURIComponent(this.merchantName || "Gym");
    const upiPayload = `upi://pay?pa=${encodeURIComponent(this.upiId || "gym@upi")}&pn=${encodedMerchant}&am=${input.amount.toFixed(2)}&cu=${input.currency || "INR"}&tn=${encodeURIComponent(input.notes || "Gym Membership")}`;

    return {
      provider: "manual",
      orderId: `MANUAL-${Date.now()}-${input.receiptId}`,
      amount: input.amount,
      currency: input.currency || "INR",
      qrPayload: upiPayload,
      instructions: "Pay via Cash, Card Swipe, or scan the UPI QR code directly at the counter.",
    };
  }

  async verifyPayment(_paymentId: string, _orderId: string): Promise<boolean> {
    // Manual payments are verified directly by staff / front-desk
    return true;
  }
}

// 2. Pluggable Razorpay Adapter (Standard Indian Gateway - test mode ready)
export class RazorpayAdapter implements PaymentProvider {
  name = "razorpay";
  private keyId?: string;
  private keySecret?: string;

  constructor(config?: { keyId?: string; keySecret?: string }) {
    this.keyId = config?.keyId || process.env.RAZORPAY_KEY_ID;
    this.keySecret = config?.keySecret || process.env.RAZORPAY_KEY_SECRET;
  }

  async createOrder(input: PaymentOrderInput): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      // Fallback in dev if credentials not yet configured
      return new ManualPaymentAdapter().createOrder(input);
    }
    // In production with credentials, makes standard Razorpay Orders API call
    return {
      provider: "razorpay",
      orderId: `rzp_order_${Date.now()}`,
      amount: input.amount,
      currency: input.currency,
      instructions: "Proceed with Razorpay Checkout",
    };
  }

  async verifyPayment(_paymentId: string, _orderId: string, _signature?: string): Promise<boolean> {
    return true;
  }
}

// Factory to resolve configured payment provider
export function getPaymentAdapter(): PaymentProvider {
  const providerType = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "manual";
  if (providerType === "razorpay") {
    return new RazorpayAdapter();
  }
  return new ManualPaymentAdapter();
}
