import { AxiosResponse } from "axios";
import { ErrorResult } from "../api/types";
import logger from "./logger";

const UnixTime = (date: Date): number =>
  Math.floor((date as unknown as number) / 1000);

const getErrorResult = (error: any): ErrorResult => {
  let errorMsg: string;

  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (error?.response?.description) {
    errorMsg = error.response.description;
  } else {
    logger.error(error);
    errorMsg = "unknown error";
  }

  return {
    errors: [
      {
        msg: errorMsg
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
