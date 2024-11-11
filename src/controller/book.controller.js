import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { Book } from "../model/book.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { SendEmailUtil } from "../utils/emailSender.js";
import mongoose from "mongoose";
const createbookService = asyncHandler(async (req, res) => {
  console.log("req.user ", req.user);
  console.log("req.body", req.body);
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    serviceName,
    serviceArea,
    address,
    mapAddress,
  } = req.body;

  if (
    [
      firstName,
      lastName,
      email,
      phoneNumber,
      serviceName,
      serviceArea,
      address,
      mapAddress,
    ].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const orderDetails = await Book.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    serviceName,
    serviceArea,
    address,
    mapAddress,
    status: false,
    user: req.user._id,
  });
  console.log("orderDetails", orderDetails);

  const body = {
    from: `${process.env.EMAIL_TITLE_SMTP} <${process.env.EMAIL_ID_SMTP}>`,
    to: email,
    subject: "Greetings",
    html: `<h2>Hello ${firstName} ${lastName}</h2>
                    <p>thanks to place an Order</p>
                    <p>Stay tuned with us</p>
                    <p>If you did not initiate this request, please contact us immediately at zeeshan@gmail.com</p>
                    <strong>Developer Team</strong>`,
  };
  const message = "Order placed successfully!";
  try {
    await SendEmailUtil(body);
    res.status(200).json(new ApiResponse(200, orderDetails, message));
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new ApiError(500, "Error sending email");
  }
});
const getAllBookedOrders = asyncHandler(async (req, res) => {
  const bookedOrders = await Book.find(); // Fetch all booked orders from the database
  console.log("!bookedOrders.length", !bookedOrders.length);

  if (!bookedOrders.length) {
    throw new ApiError("Not orders yet to Fetched");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        bookedOrders,
        "All booked orders retrieved successfully"
      )
    );
});
const updateOrderStatus = asyncHandler(async (req, res) => {
  console.log("req.params.id", req.params.id);

  const id = req.params.id;
  // Validate if the ID is a valid MongoDB ObjectID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(401, "Invalid order ID format");
  }
  const updateData = await Book.findByIdAndUpdate(
    id,
    {
      $set: {
        status: true,
      },
    },
    {
      new: true,
    }
  );
  console.log("updateData", updateData);

  res
    .status(200)
    .json(
      new ApiResponse(200, updateData, "order status updated successfully")
    );
});
export { createbookService, getAllBookedOrders,updateOrderStatus };
