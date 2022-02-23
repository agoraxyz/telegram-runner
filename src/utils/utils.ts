/* eslint-disable consistent-return */
import axios, { AxiosResponse } from "axios";
import { ActionError, ErrorResult } from "../api/types";
import config from "../config";
import { Poll } from "../service/types";
import logger from "./logger";

const UnixTime = (date: Date): number =>
  Math.floor((date as unknown as number) / 1000);

const getErrorResult = (error: any): ErrorResult => {
  let errorMsg: string;
  let ids: string[];

  if (error instanceof ActionError) {
    errorMsg = error.message;
    ids = error.ids;
  } else if (error?.response?.description) {
    errorMsg = error.response.description;
    ids = [];
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

const extractBackendErrorMessage = (error: any) =>
  error.response?.data?.errors[0]?.msg;

const updatePollText = async (
  pollText: string,
  poll: Poll
): Promise<string> => {
  let allVotes = 0;
  const newPollText = pollText.replace(poll.question, "").split(" ");

  const pollResult = await axios.get(
    `${config.backendUrl}/poll/result/${poll.id}`
  );

  logAxiosResponse(pollResult);
  if (pollResult.data.length === 0) {
    throw new Error("Poll query failed for counting result.");
  }

  poll.options.forEach((option: string) => {
    allVotes += pollResult.data[option];
  });

  let j: number = 0;
  for (let i = 0; i < newPollText.length; i += 1) {
    if (newPollText[i] === `\n▫️${poll.options[j]}\n`) {
      if (pollResult.data[poll.options[j]] > 0) {
        const persentage = (
          (pollResult.data[poll.options[j]] / allVotes) *
          100
        ).toFixed(2);
        newPollText[i + 1] = `${persentage}%`;
      } else {
        newPollText[i + 1] = `0%`;
      }
      j += 1;
    }
  }
  return poll.question + newPollText.join(" ");
};

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  extractBackendErrorMessage,
  updatePollText
};
