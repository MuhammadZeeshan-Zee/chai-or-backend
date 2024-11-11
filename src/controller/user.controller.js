import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { SendEmailUtil } from "../utils/emailSender.js";
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;
  if (
    [firstName, lastName, email, phoneNumber, password].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }
  // if (!email.includes("@")) {
  //   throw new ApiError(400, "Please enter valid email");
  // }
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "User is Already exist in database");
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    avtar: "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.gentertaeAccessToken();
    const refreshToken = user.gentertaeRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while genterating access and refresh Token"
    );
  }
};
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email && !password) {
    throw new ApiError(400, "All fields are required");
  }
  if (!email.includes("@")) {
    throw new ApiError(400, "Please enter valid email");
  }
  const user = await User.findOne({ email });
  console.log("user", user);
  if (!user) {
    throw new ApiError(404, "User is not exist in database");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  console.log("isPasswordValid", isPasswordValid);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentials Invalid password");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log("loggedInUser", loggedInUser);
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn Successfully"
      )
    );
});
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logout Successfully"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(400, "unauthorized request refresh token not found");
  }
  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );
  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid Refresh Token or already used");
  }
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "unauthorized request");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        "access token refreshed successfully"
      )
    );
});
const changePassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword, confirmPassword } = req.body;
  // if(!newPassword && !oldPassword && !confirmPassword) return
  if (newPassword !== confirmPassword) {
    throw new ApiError("new  password and confirm password not matched");
  }
  const user = await User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});
const updateUserDetails = asyncHandler(async (req, res) => {
  console.log("req.user", req.user);

  const { firstName, lastName, phoneNumber } = req.body;
  if (!firstName || !lastName || !phoneNumber) {
    throw new ApiError("All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        firstName,
        lastName,
        phoneNumber,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details updated successfully"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  console.log(1);
  let avtarLocalPath;
  // if (files && Array.isArray(files.avatar) && files.avatar.length > 0) {
  avtarLocalPath = req.files?.avatar[0]?.path;
  // }

  if (!avtarLocalPath) {
    throw new ApiError("Avtar image is missing");
  }
  const avtarCloud = await uploadOnCloudinary(avtarLocalPath);
  console.log("avtarCloud", avtarCloud);

  if (!avtarCloud.url) {
    throw new ApiError("Error while uploading Avtar on cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avtar: avtarCloud.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated Successfully"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError("You are not registered");
  }
  console.log("user", user);

  user.otp = Math.floor(1000 + Math.random() * 9000).toString();
  user.otpExpires = Date.now() + 300000;
  const savedUser = await user.save({ validateBeforeSave: false });
  console.log("savedUser", savedUser);
  const body = {
    from: `${process.env.EMAIL_TITLE_SMTP} <${process.env.EMAIL_ID_SMTP}>`,
    to: email,
    subject: "Authentication",
    html: `<h2>Hello ${email}</h2>
        <p>Your OTP is <strong>${user.otp}</strong></p>
        <p>If you did not initiate this request, please contact us immediately at eg@.com</p>
        <p>Thank you</p>
        <strong>Developer Team</strong>`,
  };
  const message = "Please check your email to verify!";

  try {
    await SendEmailUtil(body);
    res.status(200).json(new ApiResponse(200, {}, message));
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new ApiError(500, "Error sending email");
  }
});
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email, otp });
  if (!user || user.otpExpires < Date.now())
    throw new ApiError(400, "Invalid or expired OTP");

  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.status(200).json(new ApiResponse(200, { email }, "OTP verified"));
});
const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await User.findOne({ email });

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  forgotPassword,
  verifyOTP,
  resetPassword,
};
