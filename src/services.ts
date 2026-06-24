import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import PDFDocument from "pdfkit";
import { Resend } from "resend";
import { addDays, format } from "date-fns";
import { config, type RoleName } from "./config";
import { Coupon, Invoice, MenuItem, Order, SalarySlip, User } from "./models";

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export function signToken(user: { _id: unknown; email: string; role: RoleName; branch?: unknown }) {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(
    { id: String(user._id), email: user.email, role: user.role, branch: user.branch ? String(user.branch) : undefined },
    config.jwtSecret,
    options
  );
}

export async function createOtp(email: string) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { otpHash, otpExpiresAt: addDays(new Date(), 1) },
    { new: true }
  );
  if (resend) {
    await resend.emails.send({
      from: config.otpFromEmail,
      to: email,
      subject: "Hungry Point login OTP",
      html: `<p>Your Hungry Point - Duraha OTP is <b>${otp}</b>. It expires soon.</p>`
    });
  }
  console.log(`Development OTP for ${email}: ${otp}`);
  return otp;
}

export async function verifyOtp(email: string, otp: string) {
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  if (!user?.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) return null;
  const ok = await bcrypt.compare(otp, user.otpHash);
  if (!ok) return null;
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  await user.save();
  return { user, token: signToken(user as never) };
}

export async function calculateOrder(input: {
  items: Array<{ menuItem: string; variant: string; quantity: number; toppings?: Array<{ name: string; price: number }>; notes?: string }>;
  couponCode?: string;
  taxRate?: number;
  serviceChargeRate?: number;
}) {
  const ids = input.items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: ids }, available: true });
  const lines = input.items.map((line) => {
    const item = menuItems.find((candidate) => String(candidate._id) === line.menuItem);
    if (!item) throw new Error("Menu item unavailable");
    const variant = item.variants.find((candidate) => candidate.name === line.variant) || item.variants[0];
    const toppings = line.toppings || [];
    const unitPrice = Number(variant.price) + toppings.reduce((sum, topping) => sum + Number(topping.price || 0), 0);
    return {
      menuItem: item._id,
      name: item.name,
      variant: variant.name,
      quantity: line.quantity,
      unitPrice,
      toppings,
      notes: line.notes,
      status: "PENDING"
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  let discount = 0;
  if (input.couponCode) {
    const coupon = await Coupon.findOne({ code: input.couponCode.toUpperCase(), active: true });
    if (coupon && subtotal >= Number(coupon.minOrderValue || 0) && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
      discount = coupon.type === "PERCENTAGE" ? subtotal * (Number(coupon.value) / 100) : Number(coupon.value || 0);
    }
  }
  const taxable = Math.max(subtotal - discount, 0);
  const tax = taxable * ((input.taxRate || 0) / 100);
  const serviceCharge = taxable * ((input.serviceChargeRate || 0) / 100);
  const total = Math.round((taxable + tax + serviceCharge) * 100) / 100;
  return { lines, subtotal, discount, tax, serviceCharge, total };
}

export async function createInvoice(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");
  const invoiceNumber = `HPD-INV-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoice = await Invoice.create({
    order: order._id,
    invoiceNumber,
    total: order.total,
    expiresAt: addDays(new Date(), 30)
  });
  invoice.url = `${config.invoiceBaseUrl}/${invoice._id}/pdf`;
  await invoice.save();
  return invoice;
}

export async function invoicePdfBuffer(invoiceId: string) {
  const invoice = await Invoice.findById(invoiceId).populate({ path: "order", model: Order });
  if (!invoice || !invoice.order) throw new Error("Invoice not found");
  const order = invoice.order as any;
  const doc = new PDFDocument({ margin: 42, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.fontSize(22).text("Hungry Point - Duraha", { align: "center" });
  doc.fontSize(10).text("Railway Rd, SBS Nagar, Doraha, Punjab", { align: "center" });
  doc.text(`Contact: ${config.cafePhone}`, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice: ${invoice.invoiceNumber}`);
  doc.text(`Order: ${order?.orderNumber}`);
  doc.text(`Date: ${format(new Date(invoice.createdAt), "dd MMM yyyy, hh:mm a")}`);
  doc.text(`Customer: ${order?.customer?.name || "Walk-in"} ${order?.customer?.phone || ""}`);
  doc.moveDown();
  doc.fontSize(13).text("Items");
  order?.items.forEach((item: any) => {
    doc.fontSize(11).text(`${item.quantity} x ${item.name} (${item.variant}) - Rs. ${item.unitPrice * item.quantity}`);
  });
  doc.moveDown();
  doc.text(`Subtotal: Rs. ${order?.subtotal}`);
  doc.text(`Discount: Rs. ${order?.discount}`);
  doc.text(`Tax: Rs. ${order?.tax}`);
  doc.text(`Service charge: Rs. ${order?.serviceCharge}`);
  doc.fontSize(15).text(`Total: Rs. ${order?.total}`, { align: "right" });
  doc.moveDown();
  doc.fontSize(11).text("Thank you for ordering from Hungry Point - Duraha.", { align: "center" });
  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export function whatsappText(order: { orderNumber?: string; customer?: { name?: string }; total?: number }, invoiceLink: string) {
  return `Thank you for ordering from Hungry Point - Duraha. Customer: ${order.customer?.name || "Guest"}. Order ID: ${order.orderNumber}. Total: Rs. ${order.total}. Your bill/order invoice is here: ${invoiceLink}. This link will be available for 30 days.`;
}

export async function generateSalarySlip(employeeId: string, month: string, baseSalary: number, presentDays: number, extras = { deductions: 0, bonus: 0, advance: 0, overtimePay: 0 }) {
  const netSalary = Math.max((baseSalary / 30) * presentDays - extras.deductions - extras.advance + extras.bonus + extras.overtimePay, 0);
  return SalarySlip.create({ employee: employeeId, month, baseSalary, presentDays, ...extras, netSalary });
}
