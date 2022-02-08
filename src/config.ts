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
const mtprotoApiId = process.env.MTPROTO_API_ID;
const mtprotoApiHash = process.env.MTPROTO_API_HASH;
const api = {
  prefix: "/api",
  port: process.env.PORT || 8991
};
const supergroupVideo = process.env.SUPERGROUP_VIDEO_URL;
const adminVideo = process.env.ADMIN_VIDEO_URL;
const groupIdImage = process.env.GROUPID_IMAGE;
const telegramBotId: number = 0;
const nodeEnv = process.env.NODE_ENV;

if (!telegramToken)
  throw new Error("You need to specify the bot's BOT_TOKEN in the .env file.");

if (!backendUrl)
  throw new Error("You need to specify the BACKEND_URL in the .env file.");

if (!mtprotoApiId)
  throw new Error("You need to specify the MTPROTO_API_ID in the .env file.");

if (!mtprotoApiHash)
  throw new Error("You need to specify the MTPROTO_API_HASH in the .env file.");

export default {
  telegramToken,
  backendUrl,
  api,
  platform: "TELEGRAM",
  mtproto: {
    apiId: mtprotoApiId,
    apiHash: mtprotoApiHash
  },
  assets: {
    supergroupVideo,
    groupIdImage,
    adminVideo
  },
  telegramBotId,
  nodeEnv
};
