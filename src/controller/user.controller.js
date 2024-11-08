import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { SendEmailUtil } from "../utils/emailSender.js";

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullname, password } = req.body;
  //get user details form frontend
  //validation - fields must be not empty
  //check if user already already exist: username(unique), email
  //check for images, check for avtar
  //upload them on cloudinary
  //create user object -create entrty in db
  //remove password and refreshToken field in response
  //check for user creation
  //return response

  // console.log("username", username);
  // console.log("email", email);
  // console.log("password", password);
  // if(username===''){
  //   throw new ApiError(400,'fullname is required');
  // }
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  if (!email.includes("@")) {
    throw new ApiError(400, "Please enter valid email");
  }
  const exsitedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (exsitedUser) {
    throw new ApiError(409, "User is Already exist in database");
  }
  const avtarLocalPath = req.files?.avatar[0]?.path;
  // console.log("req.files", req.files);

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avtarLocalPath) {
    throw new ApiError(400, "Avatar Image is required");
  }

  const responseAvatar = await uploadOnCloudinary(avtarLocalPath);
  // console.log("uploded on cloudniary responseAvatar ", responseAvatar);

  if (!responseAvatar) {
    throw new ApiError(
      400,
      "Avatar Image is not uploaded yet upload this again server" //server issue
    );
  }

  let coverImageLocalPath;
  let responseCoverImage;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
    console.log("coverImageLocalPath1", coverImageLocalPath);
    responseCoverImage = await uploadOnCloudinary(coverImageLocalPath);
    // console.log("uploded on cloudniary responseCoverImage ", responseCoverImage);
  }

  const user = await User.create({
    username,
    email,
    fullname,
    avtar: responseAvatar.url,
    coverImage: responseCoverImage?.url || "",
    password,
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
  const { username, email, password } = req.body;
  //get user details form frontend
  //validation - fields must be not empty
  //check if user already already exist or not: found or not
  //generate Access token and Refresh Token
  //return cookies
  console.log("req.body", req.body);
  console.log("username", username);
  console.log("email", email);
  console.log("password", password);
  // if ([username, password].some((field) => field?.trim() === "")) {
  //   throw new ApiError(400, "All fields are required");
  // }
  if (!username && !password) {
    throw new ApiError(400, "All fields are required");
  }

  const exsitedUser = await User.findOne({ username });
  console.log("exsitedUser", exsitedUser);
  if (!exsitedUser) {
    throw new ApiError(404, "User is not exist in database");
  }
  const isPasswordValid = await exsitedUser.isPasswordCorrect(password);
  console.log("isPasswordValid", isPasswordValid);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentials Invalid password");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    exsitedUser._id
  );

  const loggedInUser = await User.findById(exsitedUser._id).select(
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
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError("All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullname: fullName,
        email: email,
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
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.coverImage[0].path;
  if (!coverImageLocalPath) {
    throw new ApiError("Cover image is missing");
  }
  const coverImageCloudinary = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImageCloudinary.url) {
    throw new ApiError("Error while uploading Cover image on cloudinary");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImageCloudinary.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated Successfully"));
});
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avtar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }
  console.log("channel",channel);
  
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
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
  updateUserCoverImage,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getUserChannelProfile
};
