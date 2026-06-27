import bcrypt from "bcryptjs";
import { connectDb } from "./db";
import { Branch, Employee, User } from "./models";

async function upsertStaff() {
  await connectDb();
  const branch = await Branch.findOne() || await Branch.create({
    name: "Hungry Point - Duraha",
    address: "Railway Rd, SBS Nagar, Doraha, Punjab",
    phone: "+91 98765 43210",
    mapUrl: "https://maps.google.com/?q=Railway+Rd+SBS+Nagar+Doraha+Punjab"
  });
  const passwordHash = await bcrypt.hash("HungryPoint@123", 10);
  const staff = [
    { name: "Manager", username: "manager", email: "manager@hungrypoint.local", mobile: "+919876543213", role: "MANAGER", salary: 35000 },
    { name: "Bill Desk", username: "billdesk", email: "billdesk@hungrypoint.local", mobile: "+919876543211", role: "BILL_DESK", salary: 22000 },
    { name: "Kitchen", username: "kitchen", email: "kitchen@hungrypoint.local", mobile: "+919876543212", role: "KITCHEN", salary: 22000 }
  ];

  for (const member of staff) {
    const user = await User.findOneAndUpdate(
      { username: member.username },
      { ...member, branch: branch._id, passwordHash, active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Employee.findOneAndUpdate(
      { user: user._id },
      { user: user._id, name: member.name, mobile: member.mobile, email: member.email, role: member.role, branch: branch._id, salary: member.salary, status: "ACTIVE", joiningDate: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Staff users ready:");
  console.log("manager / HungryPoint@123");
  console.log("billdesk / HungryPoint@123");
  console.log("kitchen / HungryPoint@123");
  process.exit(0);
}

upsertStaff().catch((error) => {
  console.error(error);
  process.exit(1);
});
