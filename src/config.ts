/* eslint-disable no-unused-vars */
/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

import * as dotenv from "dotenv";

const envFound = dotenv.config();
/*
if (envFound.error && !process.env.BOT_TOKEN)
  throw new Error("Couldn't find .env file or volumes in compose.");
*/
const telegramToken = process.env.BOT_TOKEN;
const backendUrl = process.env.BACKEND_URL;
const api = {
  prefix: "/api",
  port: process.env.PORT || 8991
};

if (!telegramToken)
  throw new Error("You need to specify the bot's BOT_TOKEN in the .env file.");

if (!backendUrl)
  throw new Error("You need to specify the BACKEND_URL in the .env file.");

export default {
  telegramToken,
  backendUrl,
  api,
  platform: "TELEGRAM"
};
