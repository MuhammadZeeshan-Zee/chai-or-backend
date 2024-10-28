import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

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
export { registerUser, loginUser, logoutUser, refreshAccessToken };
