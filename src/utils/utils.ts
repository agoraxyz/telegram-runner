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

const sendPollTokenPicker = async (
  ctx: any,
  platformUserId: number,
  guildId: number
): Promise<void> => {
  const guildRes = await axios.get(`${config.backendUrl}/guild/${guildId}`);

  if (!guildRes) {
    ctx.reply("Something went wrong. Please try again or contact us.");
    return;
  }

  const requirements = guildRes.data.roles[0].requirements.filter(
    (requirement) => requirement.type === "ERC20"
  );

  if (requirements.length === 0) {
    await Bot.Client.sendMessage(
      platformUserId,
      "Your guild has no requirement with an appropriate token standard." +
        "Weighted polls only support ERC20."
    );
    return;
  }

  const tokenButtons = requirements.map((requirement) => {
    const { name, chain, address, id } = requirement;

    return [
      {
        text: `${name}-${chain}-${address}`,
        callback_data: `${name}-${chain};${id};PickRequirement`
      }
    ];
  });

  await Bot.Client.sendMessage(
    platformUserId,
    "Let's start creating your poll. You can use /reset or /cancel to restart or stop the process at any time.\n\n" +
      "First, please choose a token as the base of the weighted vote.",
    {
      reply_markup: {
        inline_keyboard: tokenButtons
      }
    }
  );
};

const initPoll = async (ctx): Promise<void> => {
  const { update } = ctx;

  let chatId: number;
  let platformUserId;

  if (update.channel_post) {
    chatId = update.channel_post.chat.id;

    const creatorId = (await Bot.Client.getChatAdministrators(chatId))
      .filter((admin) => admin.status === "creator")
      .map((admin) => admin.user.id)[0];

    platformUserId = String(creatorId);
  } else {
    chatId = update.chat.id;
    platformUserId = update.from.id;
  }

  try {
    const chatMember = await Bot.Client.getChatMember(chatId, platformUserId);
    const memberStatus = chatMember.status;

    const guildIdRes = await axios.get(
      `${config.backendUrl}/guild/platformId/${chatId}`
    );

    logAxiosResponse(guildIdRes);

    if (!guildIdRes) {
      ctx.reply("Please use this command in a guild.");
      return;
    }

    if (!(memberStatus === "creator" || memberStatus === "administrator")) {
      ctx.reply("You are not an admin.");
      return;
    }

    await sendPollTokenPicker(ctx, platformUserId, guildIdRes.data.id);

    const userStep = pollStorage.getUserStep(platformUserId);

    if (userStep) {
      pollStorage.deleteMemory(platformUserId);
    }

    pollStorage.initPoll(platformUserId, chatId.toString());
    pollStorage.setUserStep(platformUserId, 1);

    if (update.channel_post) {
      return;
    }
    if (!chatMember) {
      return await ctx.reply("Check your private messages!");
    }
    const { username, first_name } = chatMember.user;

    if (!username) {
      return await ctx.replyWithMarkdown(
        `[${first_name}](tg://user?id=${platformUserId}) check your private messages!`
      );
    }
    return await ctx.reply(`@${username} check your private messages!`);
  } catch (err) {
    logger.error(err);
  }
};

const createPollText = async (
  poll: Poll,
  chatId: number | string
): Promise<string> => {
  const { id, question, options, expDate } = poll;
  const titleText = `Poll #${id}: ${question}\n\n`;
  const pollResult = await axios.get(`${config.backendUrl}/poll/result/${id}`);

  logAxiosResponse(pollResult);

  if (pollResult.data.length === 0) {
    throw new Error("Poll query failed for counting result.");
  }

  const allVotes = poll.options
    .map((option) => pollResult.data[option])
    .reduce((a, b) => a + b);

  const optionsText = poll.options
    .map(
      (option) =>
        `${option}\n▫️${
          pollResult.data[option] > 0
            ? ((pollResult.data[option] / allVotes) * 100).toFixed(2)
            : "0"
        }%`
    )
    .join("\n\n");

  const votersResponse = await axios.get(
    `${config.backendUrl}/poll/voters/${id}`
  );

  logAxiosResponse(votersResponse);

  if (votersResponse.data.length === 0) {
    throw new Error("Failed to query user votes.");
  }

  const votesByOption: {
    [k: string]: UserVote[];
  } = votersResponse.data;

  const numOfVoters = options
    .map((option) => votesByOption[option].length)
    .reduce((a, b) => a + b);

  const votersText = `👥[${numOfVoters} person${
    numOfVoters === 1 ? "" : "s"
  }](https://t.me/${
    config.botUsername
  }?start=voters_${id}_${chatId}) voted so far.`;

  const dateText = dayjs().isAfter(dayjs.unix(expDate))
    ? "Poll has already ended."
    : `Poll ends on ${dayjs
        .unix(expDate)
        .utc()
        .format("YYYY-MM-DD HH:mm UTC")}`;

  return `${titleText}\n\n${optionsText}\n\n${votersText}\n\n${dateText}`;
};

const createVoteListText = async (
  chatId: string,
  poll: Poll,
  showBalance: boolean = true
): Promise<string> => {
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

  const allVotes = poll.options
    .map((option) => pollResult.data[option])
    .reduce((a, b) => a + b);

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
          const chatMember = await Bot.Client.getChatMember(
            chatId,
            parseInt(vote.tgId, 10)
          );

          if (showBalance) {
            optionVotes[option].push(
              chatMember
                ? `${chatMember.user.first_name} ${vote.balance}\n`
                : `Unknown_User ${vote.balance}\n`
            );
          } else {
            optionVotes[option].push(
              chatMember ? `${chatMember.user.first_name}\n` : `Unknown_User\n`
            );
          }
        })
      );
    })
  );

  const pollResults = poll.options
    .map((option) => {
      const percentage =
        pollResult.data[option] > 0
          ? ((pollResult.data[option] / allVotes) * 100).toFixed(2)
          : 0;

      return `▫️ ${option} - ${percentage}%\n${optionVotes[option].join("")}`;
    })
    .join("\n");

  return `Results\n\n${pollResults}`;
};

const pollBuildResponse = async (userId: number): Promise<boolean> => {
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

const updatePollTexts = async (
  pollText: string,
  newPollText: string,
  poll: Poll,
  chatId: string,
  pollMessageId: string,
  adminId: number,
  adminMessageId: number
): Promise<void> => {
  try {
    if (newPollText === pollText) {
      return;
    }

    if (dayjs().isAfter(dayjs.unix(poll.expDate))) {
      await Bot.Client.editMessageText(
        adminId,
        adminMessageId,
        undefined,
        newPollText,
        { parse_mode: "Markdown" }
      );

      await Bot.Client.editMessageText(
        chatId,
        parseInt(pollMessageId, 10),
        undefined,
        newPollText,
        { parse_mode: "Markdown" }
      );

      return;
    }

    const voteButtonRow = poll.options.map((option) => [
      {
        text: option,
        callback_data: `${option};${poll.id};${adminId}:${adminMessageId};Vote`
      }
    ]);

    const listVotersButton = {
      text: "List Voters",
      callback_data: `${chatId}:${pollMessageId};${poll.id};ListVoters`
    };

    const updateResultButton = {
      text: "Update Result",
      callback_data: `${chatId}:${pollMessageId};${poll.id};UpdateResult`
    };

    await Bot.Client.editMessageText(
      chatId,
      parseInt(pollMessageId, 10),
      undefined,
      newPollText,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: voteButtonRow
        }
      }
    );

    await Bot.Client.editMessageText(
      adminId,
      adminMessageId,
      undefined,
      newPollText,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[listVotersButton, updateResultButton]]
        }
      }
    );
  } catch (err) {
    logger.error(err);
  }
};

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  extractBackendErrorMessage,
  initPoll,
  createPollText,
  createVoteListText,
  pollBuildResponse,
  sendPollTokenPicker,
  updatePollTexts
};
