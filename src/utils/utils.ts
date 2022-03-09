/* eslint-disable consistent-return */
import axios, { AxiosResponse } from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ErrorResult } from "../api/types";
import Bot from "../Bot";
import config from "../config";
import pollStorage from "../service/pollStorage";
import { Poll, UserVote } from "../service/types";
import logger from "./logger";

dayjs.extend(utc);

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

const updatePollText = async (poll: Poll): Promise<string> => {
  let allVotes = 0;
  let numOfVoters = 0;
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

  const votersResponse = await axios.get(
    `${config.backendUrl}/poll/voters/${poll.id}`
  );
  logAxiosResponse(votersResponse);

  if (votersResponse.data.length === 0) {
    throw new Error("Failed to query user votes.");
  }

  const votesByOption: {
    [k: string]: UserVote[];
  } = votersResponse.data;

  poll.options.forEach((option: string) => {
    numOfVoters += votesByOption[option].length;
  });

  newPollText = newPollText.concat(`👥${numOfVoters} person voted so far.`);

  if (dayjs().isAfter(dayjs.unix(poll.expDate))) {
    newPollText = newPollText.concat("\n\nPoll has already ended.");
  } else {
    newPollText = newPollText.concat(
      `\n\nPoll ends on ${dayjs
        .unix(poll.expDate)
        .utc()
        .format("YYYY-MM-DD HH:mm UTC")}`
    );
  }

  return newPollText;
};

const createVoteListText = async (
  chatId: string,
  poll: Poll
): Promise<string> => {
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

  await Promise.all(
    poll.options.map(async (option) => {
      const votes = votesByOption[option];
      await Promise.all(
        votes.map(async (vote) => {
          const ChatMember = await Bot.Client.getChatMember(
            chatId,
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

const pollBildResponse = async (userId: string): Promise<boolean> => {
  switch (pollStorage.getUserStep(userId)) {
    case undefined:
      await Bot.Client.sendMessage(
        userId,
        "Please use the /poll command in a guild."
      );
      return true;
    case 0:
      await Bot.Client.sendMessage(
        userId,
        "Please use the /poll command in a guild."
      );
      return true;
    case 1:
      await Bot.Client.sendMessage(
        userId,
        "A poll must have a token as the base of the weighted vote."
      );
      return true;
    case 2:
      await Bot.Client.sendMessage(
        userId,
        "A poll must have a question. Please send me the question of your poll."
      );
      return true;
    case 3:
      await Bot.Client.sendMessage(
        userId,
        "A poll must have a duration. Please send me the duration of your poll in DD:HH:mm format."
      );
      return true;
    case 4:
      await Bot.Client.sendMessage(
        userId,
        "A poll must have options. Please send me the first one."
      );
      return true;
    case 5:
      await Bot.Client.sendMessage(
        userId,
        "A poll must have more than one option. Please send me a second one."
      );
      return true;
    default:
      break;
  }
  return false;
};

const sendPollTokenPicker = async (
  ctx: any,
  guildId: number
): Promise<void> => {
  const guildRes = await axios
    .get(`${config.backendUrl}/guild/${guildId}`)
    .catch(() => undefined);

  if (!guildRes) {
    ctx.reply("Something went wrong. Please try again or contact us.");
    return;
  }

  const requirements = guildRes.data.roles[0].role.requirements.filter(
    (requirement) => requirement.type === "ERC20"
  );

  if (requirements.length === 0) {
    await Bot.Client.sendMessage(
      ctx.message.from.id,
      "Your guild has no requirement with an appropriate token standard." +
        "Creating a weighted poll with the NFT or the 1155 standard is not supported."
    );
    return;
  }

  const tokenButtons: { text: string; callback_data: string }[][] = [];

  requirements.forEach((requirement) => {
    const button = [
      {
        text: `${requirement.name}-${requirement.chain}-${requirement.address}`,
        callback_data: `${requirement.name}-${requirement.chain};${requirement.id};PickRequirement`
      }
    ];
    tokenButtons.push(button);
  });

  await Bot.Client.sendMessage(
    ctx.message.from.id,
    "Let's start creating your poll. You can use /reset or /cancel to restart or stop the process any time.\n\n" +
      "First, choose a token as the base of the weighted vote.",
    {
      reply_markup: {
        inline_keyboard: tokenButtons
      }
    }
  );
};

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  extractBackendErrorMessage,
  updatePollText,
  createVoteListText,
  pollBildResponse,
  sendPollTokenPicker
};
