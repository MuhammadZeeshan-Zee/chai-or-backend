import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
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
export { registerUser };
