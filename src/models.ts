import { Schema, model, Types } from "mongoose";
import { roles } from "./config";

const money = { type: Number, default: 0, min: 0 };
const requiredString = { type: String, required: true, trim: true };

export const Branch = model("Branch", new Schema({
  name: requiredString,
  address: requiredString,
  phone: String,
  mapUrl: String,
  openingHours: { type: String, default: "10:00 AM - 11:00 PM" },
  active: { type: Boolean, default: true }
}, { timestamps: true }));

export const User = model("User", new Schema({
  name: requiredString,
  username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  email: { ...requiredString, lowercase: true, unique: true },
  mobile: String,
  passwordHash: String,
  role: { type: String, enum: roles, default: "EMPLOYEE" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  active: { type: Boolean, default: true },
  otpHash: String,
  otpExpiresAt: Date
}, { timestamps: true }));

export const Employee = model("Employee", new Schema({
  user: { type: Types.ObjectId, ref: "User" },
  name: requiredString,
  mobile: requiredString,
  email: { ...requiredString, lowercase: true },
  address: String,
  role: { type: String, enum: roles, default: "EMPLOYEE" },
  joiningDate: Date,
  salary: money,
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  branch: { type: Types.ObjectId, ref: "Branch" },
  profileImage: String,
  documents: [String]
}, { timestamps: true }));

export const Attendance = model("Attendance", new Schema({
  employee: { type: Types.ObjectId, ref: "Employee", required: true },
  branch: { type: Types.ObjectId, ref: "Branch" },
  date: { type: String, required: true },
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ["PRESENT", "ABSENT", "HALF_DAY", "LATE"], default: "PRESENT" },
  overtimeMinutes: { type: Number, default: 0 },
  notes: String
}, { timestamps: true }));

export const SalarySlip = model("SalarySlip", new Schema({
  employee: { type: Types.ObjectId, ref: "Employee", required: true },
  month: requiredString,
  baseSalary: money,
  presentDays: { type: Number, default: 0 },
  deductions: money,
  bonus: money,
  advance: money,
  overtimePay: money,
  netSalary: money,
  pdfUrl: String,
  status: { type: String, enum: ["DRAFT", "PAID"], default: "DRAFT" }
}, { timestamps: true }));

export const MenuCategory = model("MenuCategory", new Schema({
  name: requiredString,
  slug: { ...requiredString, unique: true },
  description: String,
  image: String,
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true }));

export const Addon = model("Addon", new Schema({
  name: requiredString,
  price: money,
  active: { type: Boolean, default: true }
}, { timestamps: true }));

export const MenuItem = model("MenuItem", new Schema({
  name: requiredString,
  description: String,
  category: { type: Types.ObjectId, ref: "MenuCategory", required: true },
  image: String,
  tags: [String],
  variants: [{
    name: { type: String, enum: ["Regular", "Medium", "Large", "Giant", "Single"], default: "Single" },
    price: money
  }],
  toppings: [{ type: Types.ObjectId, ref: "Addon" }],
  veg: { type: Boolean, default: true },
  available: { type: Boolean, default: true },
  preparationMinutes: { type: Number, default: 12 }
}, { timestamps: true }));

export const Coupon = model("Coupon", new Schema({
  code: { ...requiredString, uppercase: true, unique: true },
  title: requiredString,
  type: { type: String, enum: ["PERCENTAGE", "FLAT", "BOGO", "CATEGORY"], required: true },
  value: money,
  minOrderValue: money,
  category: { type: Types.ObjectId, ref: "MenuCategory" },
  expiresAt: Date,
  active: { type: Boolean, default: true }
}, { timestamps: true }));

export const Order = model("Order", new Schema({
  orderNumber: { type: String, unique: true, index: true },
  branch: { type: Types.ObjectId, ref: "Branch" },
  customer: {
    name: String,
    phone: String,
    address: String,
    tableNumber: String
  },
  type: { type: String, enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"], default: "TAKEAWAY" },
  items: [{
    menuItem: { type: Types.ObjectId, ref: "MenuItem" },
    name: String,
    variant: String,
    quantity: Number,
    unitPrice: Number,
    toppings: [{ name: String, price: Number }],
    notes: String,
    status: { type: String, enum: ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"], default: "PENDING" }
  }],
  couponCode: String,
  subtotal: money,
  discount: money,
  tax: money,
  serviceCharge: money,
  total: money,
  paymentMethod: { type: String, enum: ["CASH", "UPI", "CARD", "ONLINE", "PENDING"], default: "PENDING" },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING" },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "DELIVERED", "CANCELLED"], default: "PENDING" },
  notes: String
}, { timestamps: true }));

export const Invoice = model("Invoice", new Schema({
  order: { type: Types.ObjectId, ref: "Order", required: true },
  invoiceNumber: { type: String, unique: true },
  url: String,
  expiresAt: Date,
  total: money
}, { timestamps: true }));

export const Payment = model("Payment", new Schema({
  order: { type: Types.ObjectId, ref: "Order", required: true },
  amount: money,
  method: { type: String, enum: ["CASH", "UPI", "CARD", "ONLINE"], required: true },
  status: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PAID" },
  reference: String
}, { timestamps: true }));

export const Review = model("Review", new Schema({
  name: requiredString,
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: requiredString,
  orderId: String,
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  featured: { type: Boolean, default: false }
}, { timestamps: true }));

export const Setting = model("Setting", new Schema({
  key: { ...requiredString, unique: true },
  value: Schema.Types.Mixed
}, { timestamps: true }));
