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

const extractBackendErrorMessage = (error: any) =>
  error.response?.data?.errors[0]?.msg;

const updatePollText = async (
  pollText: string,
  poll: Poll
): Promise<string> => {
  let allVotes = 0;
  const newPollText = pollText.replace(poll.question, "").split("\n");

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
    if (newPollText[i] === `▫️${poll.options[j]}`) {
      if (pollResult.data[poll.options[j]] > 0) {
        const persentage = (
          (pollResult.data[poll.options[j]] / allVotes) *
          100
        ).toFixed(2);
        newPollText[i + 1] = ` ${persentage}%`;
      } else {
        newPollText[i + 1] = ` 0%`;
      }
      j += 1;
    }
  }
  return poll.question + newPollText.join("\n");
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
