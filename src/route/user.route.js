import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  resetPassword,
  updateUserDetails,
  updateUserAvatar,
  forgotPassword,
  verifyOTP,
  changePassword,
  getUserChannelProfile,
  getWatchHistory,
} from "../controller/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const router = Router();
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
// secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refreshAccessToken").post(refreshAccessToken);
router.route("/changePassword").post(verifyJWT, changePassword);
router.route("/updateUserDetails").post(verifyJWT, updateUserDetails);
router.route("/updateAvatar").post(
  verifyJWT,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  updateUserAvatar
);

router.route("/forgotPassword").post(forgotPassword);
router.route("/verifyOTP").post(verifyOTP);
router.route("/resetPassword").post(resetPassword);
router.route("/getUserChannelProfile/:username").get(getUserChannelProfile);
router.route("/getWatchHistory").get(verifyJWT, getWatchHistory);
export default router;
