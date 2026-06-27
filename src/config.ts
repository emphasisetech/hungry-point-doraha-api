import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hungry-point-doraha",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  resendApiKey: process.env.RESEND_API_KEY || "",
  otpFromEmail: process.env.OTP_FROM_EMAIL || "Hungry Point <otp@example.com>",
  cafePhone: process.env.CAFE_PHONE || "+919876543210",
  whatsappMode: process.env.WHATSAPP_MODE || "simple",
  whatsappApiUrl: process.env.WHATSAPP_API_URL || "",
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN || "",
  invoiceBaseUrl: process.env.INVOICE_BASE_URL || "http://localhost:4000/api/invoices"
};

export const roles = [
  "SUPER_ADMIN",
  "HEAD_OFFICE_ADMIN",
  "MANAGER",
  "BILL_DESK",
  "CASHIER",
  "ORDER_MANAGER",
  "COOK",
  "KITCHEN",
  "WAITER",
  "DELIVERY",
  "EMPLOYEE"
] as const;

export type RoleName = (typeof roles)[number];
