import { Router } from "express";
import { z } from "zod";
import { addDays, format } from "date-fns";
import bcrypt from "bcryptjs";
import { auth, allow, validate, type AuthedRequest } from "./middleware";
import { Attendance, Branch, Coupon, Employee, Invoice, MenuCategory, MenuItem, Order, Payment, Review, SalarySlip, Setting, User } from "./models";
import { calculateOrder, createInvoice, createOtp, generateSalarySlip, invoicePdfBuffer, verifyOtp, verifyPasswordLogin, whatsappText } from "./services";
import { config } from "./config";
import type { Server } from "socket.io";
import type { Model } from "mongoose";

const adminRoles = ["SUPER_ADMIN", "HEAD_OFFICE_ADMIN", "MANAGER"] as const;
const staffRoles = ["SUPER_ADMIN", "HEAD_OFFICE_ADMIN", "MANAGER", "BILL_DESK", "CASHIER", "ORDER_MANAGER"] as const;
const kitchenRoles = ["SUPER_ADMIN", "HEAD_OFFICE_ADMIN", "COOK", "KITCHEN"] as const;

export function routes(io: Server) {
  const router = Router();

  router.get("/health", (_req, res) => res.json({ ok: true, service: "Hungry Point - Duraha API" }));

  router.post("/auth/request-otp", validate(z.object({ body: z.object({ email: z.string().email() }) })), async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), active: true });
    if (!user) return res.status(404).json({ message: "No active user found for this email" });
    const devOtp = await createOtp(req.body.email);
    res.json({ message: "OTP sent", devOtp: config.resendApiKey ? undefined : devOtp });
  });

  router.post("/auth/verify-otp", validate(z.object({ body: z.object({ email: z.string().email(), otp: z.string().min(4) }) })), async (req, res) => {
    const result = await verifyOtp(req.body.email, req.body.otp);
    if (!result) return res.status(401).json({ message: "Invalid OTP" });
    res.json({ token: result.token, user: result.user });
  });

  router.post("/auth/login", validate(z.object({ body: z.object({ username: z.string().min(2), password: z.string().min(4) }) })), async (req, res) => {
    const result = await verifyPasswordLogin(req.body.username, req.body.password);
    if (!result) return res.status(401).json({ message: "Invalid username or password" });
    res.json({ token: result.token, user: result.user });
  });

  router.get("/menu/categories", async (_req, res) => res.json(await MenuCategory.find({ active: true }).sort("sortOrder name")));
  router.get("/menu/items", async (req, res) => {
    const query: Record<string, unknown> = { available: true };
    if (req.query.category) query.category = req.query.category;
    if (req.query.search) query.name = { $regex: String(req.query.search), $options: "i" };
    res.json(await MenuItem.find(query).populate("category toppings").sort("name"));
  });

  router.post("/orders", async (req, res) => {
    const totals = await calculateOrder(req.body);
    const count = await Order.countDocuments();
    const order = await Order.create({
      ...req.body,
      orderNumber: `HPD-${format(new Date(), "yyMMdd")}-${String(count + 1).padStart(4, "0")}`,
      items: totals.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      serviceCharge: totals.serviceCharge,
      total: totals.total
    });
    io.emit("order:new", order);
    res.status(201).json(order);
  });

  router.get("/orders/:id", async (req, res) => res.json(await Order.findById(req.params.id).populate("items.menuItem")));
  router.get("/orders", auth, allow(...staffRoles, ...kitchenRoles, "WAITER", "DELIVERY"), async (req, res) => {
    const query: Record<string, unknown> = {};
    if (req.query.status) query.status = req.query.status;
    res.json(await Order.find(query).sort("-createdAt").limit(Number(req.query.limit || 100)));
  });

  router.patch("/orders/:id/status", auth, allow(...staffRoles, ...kitchenRoles, "WAITER", "DELIVERY"), async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    io.emit("order:status", order);
    if (["COMPLETED", "DELIVERED"].includes(order.status)) {
      const invoice = await createInvoice(String(order._id));
      io.emit("invoice:created", invoice);
    }
    res.json(order);
  });

  router.post("/payments", auth, allow(...staffRoles), async (req, res) => {
    const payment = await Payment.create(req.body);
    await Order.findByIdAndUpdate(req.body.order, { paymentStatus: payment.status, paymentMethod: payment.method });
    res.status(201).json(payment);
  });

  router.get("/invoices/:id/pdf", async (req, res) => {
    const buffer = await invoicePdfBuffer(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="hungry-point-${req.params.id}.pdf"`);
    res.send(buffer);
  });

  router.post("/invoices", auth, allow(...staffRoles), async (req, res) => res.status(201).json(await createInvoice(req.body.orderId)));

  router.post("/whatsapp/send-invoice", auth, allow(...staffRoles), async (req, res) => {
    const invoice = await Invoice.findById(req.body.invoiceId).populate({ path: "order", model: Order });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const order = invoice.order as never as { orderNumber: string; customer: { name?: string; phone?: string }; total: number };
    const message = whatsappText(order, invoice.url || `${config.invoiceBaseUrl}/${invoice._id}/pdf`);
    if (config.whatsappMode === "api" && config.whatsappApiUrl) {
      await fetch(config.whatsappApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.whatsappApiToken}` },
        body: JSON.stringify({ to: req.body.phone || order.customer?.phone, message })
      });
    }
    res.json({ mode: config.whatsappMode, redirectUrl: `https://wa.me/${req.body.phone || order.customer?.phone}?text=${encodeURIComponent(message)}`, message });
  });

  router.post("/reviews", async (req, res) => res.status(201).json(await Review.create(req.body)));
  router.get("/reviews/public", async (_req, res) => res.json(await Review.find({ status: "APPROVED", featured: true }).sort("-createdAt").limit(8)));

  const crud: Array<[string, Model<any>]> = [
    ["branches", Branch],
    ["employees", Employee],
    ["categories", MenuCategory],
    ["items", MenuItem],
    ["coupons", Coupon],
    ["reviews", Review],
    ["settings", Setting],
    ["users", User]
  ] as const;

  crud.forEach(([path, Model]) => {
    router.get(`/admin/${path}`, auth, allow(...adminRoles, ...staffRoles), async (req, res) => {
      const q = req.query.search ? { name: { $regex: String(req.query.search), $options: "i" } } : {};
      res.json(await Model.find(q).sort("-createdAt").limit(Number(req.query.limit || 100)));
    });
    router.post(`/admin/${path}`, auth, allow(...adminRoles), async (req, res) => {
      const body = { ...req.body };
      if (path === "users" && body.password) {
        body.passwordHash = await bcrypt.hash(body.password, 10);
        delete body.password;
      }
      res.status(201).json(await Model.create(body));
    });
    router.patch(`/admin/${path}/:id`, auth, allow(...adminRoles), async (req, res) => res.json(await Model.findByIdAndUpdate(req.params.id, req.body, { new: true })));
    router.delete(`/admin/${path}/:id`, auth, allow(...adminRoles), async (req, res) => res.json(await Model.findByIdAndDelete(req.params.id)));
  });

  router.post("/attendance/check-in", auth, async (req: AuthedRequest, res) => {
    const employee = await Employee.findOne({ user: req.user?.id });
    if (!employee) return res.status(404).json({ message: "Employee profile not found" });
    const date = format(new Date(), "yyyy-MM-dd");
    res.status(201).json(await Attendance.findOneAndUpdate({ employee: employee._id, date }, { checkIn: new Date(), status: "PRESENT" }, { upsert: true, new: true }));
  });

  router.post("/attendance/check-out", auth, async (req: AuthedRequest, res) => {
    const employee = await Employee.findOne({ user: req.user?.id });
    if (!employee) return res.status(404).json({ message: "Employee profile not found" });
    const date = format(new Date(), "yyyy-MM-dd");
    res.json(await Attendance.findOneAndUpdate({ employee: employee._id, date }, { checkOut: new Date() }, { new: true }));
  });

  router.get("/attendance", auth, allow(...adminRoles, "EMPLOYEE"), async (req, res) => res.json(await Attendance.find(req.query.employee ? { employee: req.query.employee } : {}).populate("employee").sort("-date")));
  router.post("/salary/generate", auth, allow(...adminRoles), async (req, res) => res.status(201).json(await generateSalarySlip(req.body.employee, req.body.month, req.body.baseSalary, req.body.presentDays, req.body)));
  router.get("/salary-slips", auth, async (_req, res) => res.json(await SalarySlip.find().populate("employee").sort("-createdAt")));

  router.get("/reports/summary", auth, allow(...adminRoles, ...staffRoles), async (_req, res) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayStart = new Date(`${today}T00:00:00.000Z`);
    const [orders, todayOrders, employees] = await Promise.all([
      Order.find(),
      Order.find({ createdAt: { $gte: todayStart } }),
      Employee.countDocuments({ status: "ACTIVE" })
    ]);
    const sales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const todaySales = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const statusCounts = orders.reduce<Record<string, number>>((acc, order) => ({ ...acc, [order.status]: (acc[order.status] || 0) + 1 }), {});
    const bestSelling = new Map<string, number>();
    orders.forEach((order) => order.items.forEach((item) => {
      const name = item.name || "Menu item";
      bestSelling.set(name, (bestSelling.get(name) || 0) + Number(item.quantity || 0));
    }));
    res.json({
      todaySales,
      monthlySales: sales,
      totalOrders: orders.length,
      employees,
      statusCounts,
      invoiceRetentionDays: 30,
      bestSellingItems: [...bestSelling.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => ({ name, qty })),
      invoiceExpiry: addDays(new Date(), 30)
    });
  });

  return router;
}
