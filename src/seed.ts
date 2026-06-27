import bcrypt from "bcryptjs";
import { connectDb } from "./db";
import { Addon, Branch, Coupon, Employee, MenuCategory, MenuItem, Review, Setting, User } from "./models";

const menu = {
  Pizza: ["Margherita Pizza", "Farm Fresh Pizza", "Paneer Tikka Pizza", "Cheese Burst Pizza"],
  Burger: ["Aloo Tikki Burger", "Veg Cheese Burger", "Paneer Burger", "Crispy Burger"],
  Sandwich: ["Veg Grilled Sandwich", "Cheese Corn Sandwich", "Paneer Sandwich"],
  Pasta: ["White Sauce Pasta", "Red Sauce Pasta", "Mix Sauce Pasta"],
  "Fries/Snacks": ["French Fries", "Peri Peri Fries", "Cheese Nuggets", "Veg Spring Roll"],
  Shakes: ["Chocolate Shake", "Oreo Shake", "Strawberry Shake", "KitKat Shake"],
  Mojito: ["Virgin Mojito", "Blue Lagoon", "Green Apple Mojito"],
  Drinks: ["Cold Coffee", "Lemon Soda", "Masala Coke"],
  Desserts: ["Brownie", "Ice Cream Cup", "Choco Lava Cake"]
};

async function seed() {
  await connectDb();
  await Promise.all([Branch.deleteMany({}), User.deleteMany({}), Employee.deleteMany({}), MenuCategory.deleteMany({}), MenuItem.deleteMany({}), Addon.deleteMany({}), Coupon.deleteMany({}), Review.deleteMany({}), Setting.deleteMany({})]);

  const branch = await Branch.create({
    name: "Hungry Point - Duraha",
    address: "Railway Rd, SBS Nagar, Doraha, Punjab",
    phone: "+91 98765 43210",
    mapUrl: "https://maps.google.com/?q=Railway+Rd+SBS+Nagar+Doraha+Punjab"
  });

  const passwordHash = await bcrypt.hash("HungryPoint@123", 10);
  const admin = await User.create({ name: "Super Admin", username: "superadmin", email: "superadmin@hungrypoint.local", mobile: "+919876543210", role: "SUPER_ADMIN", branch: branch._id, passwordHash });
  await Employee.create({ user: admin._id, name: "Super Admin", mobile: "+919876543210", email: admin.email, role: "SUPER_ADMIN", branch: branch._id, salary: 50000, joiningDate: new Date() });
  const staffUsers = await User.insertMany([
    { name: "Bill Desk", username: "billdesk", email: "billdesk@hungrypoint.local", mobile: "+919876543211", role: "BILL_DESK", branch: branch._id, passwordHash },
    { name: "Kitchen", username: "kitchen", email: "kitchen@hungrypoint.local", mobile: "+919876543212", role: "KITCHEN", branch: branch._id, passwordHash },
    { name: "Manager", username: "manager", email: "manager@hungrypoint.local", mobile: "+919876543213", role: "MANAGER", branch: branch._id, passwordHash }
  ]);
  await Employee.insertMany(staffUsers.map((user) => ({ user: user._id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, branch: branch._id, salary: user.role === "MANAGER" ? 35000 : 22000, joiningDate: new Date() })));

  const toppings = await Addon.insertMany([
    { name: "Extra Cheese", price: 35 },
    { name: "Paneer Topping", price: 45 },
    { name: "Peri Peri Masala", price: 20 },
    { name: "Extra Mayo", price: 15 }
  ]);

  let sortOrder = 1;
  for (const [categoryName, items] of Object.entries(menu)) {
    const category = await MenuCategory.create({ name: categoryName, slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), sortOrder: sortOrder++ });
    await MenuItem.insertMany(items.map((name, index) => ({
      name,
      description: `Freshly prepared ${name.toLowerCase()} from Hungry Point - Duraha.`,
      category: category._id,
      toppings: toppings.map((topping) => topping._id),
      variants: categoryName === "Pizza"
        ? [{ name: "Regular", price: 99 + index * 20 }, { name: "Medium", price: 179 + index * 30 }, { name: "Large", price: 279 + index * 40 }, { name: "Giant", price: 399 + index * 50 }]
        : [{ name: "Single", price: 59 + index * 25 }, { name: "Large", price: 99 + index * 35 }],
      tags: [categoryName, "Hungry Point"],
      preparationMinutes: 8 + index
    })));
  }

  await Coupon.insertMany([
    { code: "HPD10", title: "10% off first order", type: "PERCENTAGE", value: 10, minOrderValue: 199, active: true },
    { code: "SNACK50", title: "Rs. 50 off snacks combo", type: "FLAT", value: 50, minOrderValue: 299, active: true }
  ]);

  await Review.insertMany([
    { name: "Aman", rating: 5, comment: "Fresh food, quick service, and great shakes.", status: "APPROVED", featured: true },
    { name: "Simran", rating: 5, comment: "Best pizza stop near Railway Road Doraha.", status: "APPROVED", featured: true }
  ]);

  await Setting.insertMany([
    { key: "gstRate", value: 5 },
    { key: "serviceChargeRate", value: 0 },
    { key: "invoiceRetentionDays", value: 30 }
  ]);

  console.log("Seed complete. Staff logins:");
  console.log("manager / HungryPoint@123");
  console.log("billdesk / HungryPoint@123");
  console.log("kitchen / HungryPoint@123");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
