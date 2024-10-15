import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from '../utils/apiResponse.js'
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
  console.log("username", username);
  console.log("email", email);
  console.log("password", password);
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
  const exsitedUser = User.findOne({
    $or: [{ username }, { email }],
  });

  if (exsitedUser) {
    throw new ApiError(409, "User is Already exist in database");
  }
  const avtarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avtarLocalPath) {
    throw new ApiError(400, "Avatar Image is required");
  }
  const responseAvatar = await uploadOnCloudinary(avtarLocalPath);
  const responseCoverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!responseAvatar) {
    throw new ApiError(400, "Avatar Image is not uploaded yet upload this again");
  }
  const user=await User.create({
    username,
    email,
    fullname,
    avatar:responseAvatar.url,
    avatar:responseCoverImage?.url || "",
    password
  })
  const createdUser= User.findById(user._id).select(
    "-password -refreshToken"
  )
  if (!createdUser) {
    throw new ApiError(500,"Something went wrong while registering user")
  }
    // return res.status(201).json({createdUser})
    return res.status(201).json(
      new ApiResponse(200,createdUser,"User Registered Successfully")
    )
});
export { registerUser };
