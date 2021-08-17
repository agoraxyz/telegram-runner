import { AxiosResponse } from "axios";
import { ActionError, ErrorResult } from "../api/types";
import { hmac, redisClient } from "../database";
import logger from "./logger";

const UnixTime = (date: Date): number =>
  Math.floor((date as unknown as number) / 1000);

const getErrorResult = (error: Error): ErrorResult => {
  let errorMsg: string;
  let ids: string[];

  if (error instanceof ActionError) {
    errorMsg = error.message;
    ids = error.ids;
  } else {
    logger.error(error);
    errorMsg = "unknown error";
    ids = [];
  }

  return {
    errors: [
      {
        msg: errorMsg,
        value: ids
      }
    ]
  };
};

const logAxiosResponse = (res: AxiosResponse<any>) => {
  logger.verbose(
    `${res.status} ${res.statusText} data:${JSON.stringify(res.data)}`
  );
};

const getUserHash = async (platformUserId: string): Promise<string> => {
  hmac.update(platformUserId);
  const hashedId = hmac.digest("base64");
  let userHash = await redisClient.getAsync(hashedId);
  if (!userHash) {
    redisClient.client.SET(hashedId, platformUserId);
    userHash = await redisClient.getAsync(hashedId);
  }
  return userHash;
};

const getUserPlatformId = async (
  userHash: string
): Promise<string | undefined> => {
  const platformUserId = await redisClient.getAsync(userHash);
  return platformUserId || undefined;
};

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  getUserHash,
  getUserPlatformId
};
