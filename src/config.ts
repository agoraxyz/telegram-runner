/* eslint-disable no-unused-vars */
/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

import * as dotenv from "dotenv";

const envFound = dotenv.config();
/*
if (envFound.error && !process.env.BOT_TOKEN)
  throw new Error("Couldn't find .env file or volumes in compose.");
*/

const redisHost = process.env.REDIS_HOST;
const hmacAlgorithm = process.env.HMAC_ALGORITHM || "sha256";
const hmacSecret = process.env.HMAC_SECRET;
const telegramToken = process.env.BOT_TOKEN;
const backendUrl = process.env.BACKEND_URL;
const mtprotoApiId = process.env.MTPROTO_API_ID;
const mtprotoApiHash = process.env.MTPROTO_API_HASH;
const api = {
  prefix: "/api",
  port: process.env.PORT || 8991
};
const supergroupVideo = process.env.VIDEO_URL;
const groupIdImage = process.env.GROUPID_IMAGE;

if (!telegramToken)
  throw new Error("You need to specify the bot's BOT_TOKEN in the .env file.");

if (!backendUrl)
  throw new Error("You need to specify the BACKEND_URL in the .env file.");

if (!redisHost)
  throw new Error("You need to specify the REDIS_HOST in the .env file.");

if (!hmacSecret)
  throw new Error("You need to specify the HMAC_SECRET in the .env file.");

if (!mtprotoApiId)
  throw new Error("You need to specify the MTPROTO_API_ID in the .env file.");

if (!mtprotoApiHash)
  throw new Error("You need to specify the MTPROTO_API_HASH in the .env file.");

export default {
  redisHost,
  hmacAlgorithm,
  hmacSecret,
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
    groupIdImage
  }
};
