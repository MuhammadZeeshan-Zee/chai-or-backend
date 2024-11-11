import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN })); //request is vailed from which origin
app.use(express.json({ limit: "16kb" })); //to get data in json and also give the data limit
app.use(express.urlencoded({ extended: true, limit: "16kb" })); //to get data from url and also give the data limit
app.use(express.static("public")); //serve static assets, this data can access everyone
app.use(cookieParser()); //from your server to access cookies from user browser and set the cookies

//import Routes
import UserRoute from "./route/user.route.js";
import BookRoute from "./route/book.route.js";
import EmployeeRoute from "./route/employee.route.js";
import {createAdmin} from './scripts/adminEx.script.js'
//declaration routes
createAdmin()
app.use("/user", UserRoute);
app.use("/user", BookRoute);
app.use("/employee", EmployeeRoute);
export { app };
