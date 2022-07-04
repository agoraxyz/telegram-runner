/* eslint-disable no-unused-vars */
/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

import * as dotenv from "dotenv";
import logger from "./utils/logger";

const envFound = dotenv.config();

if (envFound.error) {
  logger.error("Couldn't find .env file or volumes in compose.");
  process.exit(1);
}

const telegramToken = process.env.BOT_TOKEN;
const backendUrl = process.env.BACKEND_URL;
const api = {
  prefix: "/api",
  port: process.env.PORT || 8991
};
const adminVideo = process.env.ADMIN_VIDEO_URL;
const groupIdImage = process.env.GROUPID_IMAGE;

if (!telegramToken) {
  throw new Error("You need to specify the bot's BOT_TOKEN in the .env file.");
}

if (!backendUrl) {
  throw new Error("You need to specify the BACKEND_URL in the .env file.");
}

export default {
  telegramToken,
  backendUrl,
  api,
  platform: "TELEGRAM",
  assets: {
    groupIdImage,
    adminVideo
  }
};
