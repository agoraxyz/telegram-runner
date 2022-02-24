/* eslint-disable consistent-return */
import axios, { AxiosResponse } from "axios";
import { ActionError, ErrorResult } from "../api/types";
import Bot from "../Bot";
import config from "../config";
import { Poll, UserVote } from "../service/types";
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

const updatePollText = async (poll: Poll): Promise<string> => {
  let allVotes = 0;
  let newPollText = `${poll.question}\n\n`;

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

  poll.options.forEach((option) => {
    newPollText = newPollText.concat(`${option}\n`);
    if (pollResult.data[option] > 0) {
      const persentage = ((pollResult.data[option] / allVotes) * 100).toFixed(
        2
      );
      newPollText = newPollText.concat(`▫️${persentage}%\n\n`);
    } else {
      newPollText = newPollText.concat(`▫️0%\n\n`);
    }
  });

  newPollText = newPollText.concat(`0 person voted so far.`);

  return newPollText;
};

const createVoteListText = async (ctx: any, poll: Poll): Promise<string> => {
  let allVotes: number = 0;
  let pollText: string = "Results:\n";

  const pollResult = await axios.get(
    `${config.backendUrl}/poll/result/${poll.id}`
  );
  logAxiosResponse(pollResult);
  if (pollResult.data.length === 0) {
    throw new Error("Poll query failed for listing votes.");
  }

  const votersResponse = await axios.get(
    `${config.backendUrl}/poll/voters/${poll.id}`
  );
  logAxiosResponse(votersResponse);
  if (votersResponse.data.length === 0) {
    throw new Error("Failed to query user votes.");
  }

  poll.options.forEach((option: string) => {
    allVotes += pollResult.data[option];
  });

  const optionVotes: {
    [k: string]: string[];
  } = Object.fromEntries(poll.options.map((option) => [option, []]));

  const votesByOption: {
    [k: string]: UserVote[];
  } = votersResponse.data;

  logAxiosResponse(votersResponse);

  await Promise.all(
    poll.options.map(async (option) => {
      const votes = votesByOption[option];
      await Promise.all(
        votes.map(async (vote) => {
          const ChatMember = await Bot.Client.getChatMember(
            ctx.update.callback_query.message.chat.id,
            parseInt(vote.tgId, 10)
          ).catch(() => undefined);

          if (!ChatMember) {
            optionVotes[option].push(`Unknown_User ${vote.balance}\n`);
          } else {
            const username = ChatMember.user.first_name;
            optionVotes[option].push(`${username} ${vote.balance}\n`);
          }
        })
      );
    })
  );

  poll.options.forEach((option: string) => {
    pollText = pollText.concat(`\n▫️ ${option} - `);
    if (pollResult.data[option] > 0) {
      const persentage = ((pollResult.data[option] / allVotes) * 100).toFixed(
        2
      );
      pollText = pollText.concat(`${persentage}%\n`);
    } else {
      pollText = pollText.concat(`0%\n`);
    }
    pollText = pollText.concat(optionVotes[option].join(""));
  });

  return pollText;
};

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  extractBackendErrorMessage,
  updatePollText,
  createVoteListText
};
