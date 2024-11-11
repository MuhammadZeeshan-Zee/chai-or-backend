import { User } from "../model/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createAdmin = asyncHandler(async (req, res) => {
  try {
    const existingAdmin = await User.findOne({
      email: "zeeshanarif3434@gmail.com",
    });
    if (!existingAdmin) {
      const createdNewAdmin = new User({
        userName: "Admin",
        email: "admin@gmail.com",
        password: await bcrypt.hash("Admin*123", 10),
        role: "admin",
      });
      await createdNewAdmin.save();
      console.log("Admin Created Successfully");
    } else {
      console.log("Admin already exist");
    }
  } catch (error) {
    throw new ApiError(400, "All fields are required");
  }
});
