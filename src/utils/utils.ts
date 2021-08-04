import { AxiosResponse } from "axios";
import { ActionError, ErrorResult } from "../api/types";
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

export { UnixTime, getErrorResult, logAxiosResponse };
