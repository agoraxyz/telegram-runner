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

const logAxiosResponse = (res: AxiosResponse<any>): AxiosResponse<any> => {
  logger.verbose(
    `${res.status} ${res.statusText} data:${JSON.stringify(res.data)}`
  );

  return res;
};

const extractBackendErrorMessage = (error: any) =>
  error.response?.data?.errors[0]?.msg;

const sendPollTokenChooser = async (
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
        callback_data: `${name}-${chain};${id};ChooseRequirement`
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
    chatId = update.message.chat.id;
    platformUserId = update.message.from.id;
  }

  try {
    const chatMember = await Bot.Client.getChatMember(chatId, platformUserId);
    const memberStatus = chatMember.status;

    const guildIdRes = await axios.get(
      `${config.backendUrl}/guild/platformId/${chatId}`
    );

    if (!guildIdRes) {
      ctx.reply("Please use this command in a guild.");
      return;
    }

    if (!(memberStatus === "creator" || memberStatus === "administrator")) {
      ctx.reply("You are not an admin.");
      return;
    }

    await sendPollTokenChooser(ctx, platformUserId, guildIdRes.data.id);

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
  results = undefined
): Promise<string> => {
  const { id, question, options, expDate } = poll;

  const [pollResults, numOfVoters] = results
    ? results.data
    : [options.map(() => 0), 0];

  const allVotes = pollResults.reduce((a, b) => a + b, 0);

  const optionsText = options
    .map((option, idx) => {
      const perc = (pollResults[idx] / (allVotes || 1)) * 100;

      return `${String.fromCharCode("a".charCodeAt(0) + idx)}) ${option}\n▫️${
        Number.isInteger(perc) ? perc : perc.toFixed(2)
      }%`;
    })
    .join("\n\n");

  dayjs.extend(utc);

  const dateText = dayjs().isAfter(dayjs.unix(+expDate))
    ? "Poll has already ended."
    : `Poll ends on ${dayjs
        .unix(+expDate)
        .utc()
        .format("YYYY-MM-DD HH:mm UTC")}`;

  const votersText = `👥 ${numOfVoters} person${
    numOfVoters === 1 ? "" : "s"
  } voted so far.`;

  return (
    `*Poll #${id}: ${question}*\n\n` +
    `${optionsText}\n\n${dateText}\n\n${votersText}`
  );
};

const sendPollMessage = async (
  platformId: string,
  poll: Poll
): Promise<number> => {
  const pollText = await createPollText(poll);

  const voteButtonRow: { text: string; callback_data: string }[][] =
    poll.options.map((option, idx) => [
      {
        text: option,
        callback_data: `${idx};${poll.id};Vote`
      }
    ]);

  const msgId = (
    await Bot.Client.sendMessage(platformId, pollText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: voteButtonRow
      }
    })
  ).message_id;

  return msgId;
};

const createVoteListText = async (
  chatId: string,
  poll: Poll,
  showBalance: boolean = true
): Promise<string> => {
  const { id, options } = poll;

  const votersResponse = await axios.get(
    `${config.backendUrl}/poll/voters/${poll.id}`
  );

  const votesByOption: {
    [k: number]: UserVote[];
  } = votersResponse.data;

  const votesForEachOption = poll.options.map((_, idx) =>
    votesByOption[idx].length
      ? votesByOption[idx].map((vote) => vote.balance).reduce((a, b) => a + b)
      : 0
  );

  const allVotes = votesForEachOption.reduce((a, b) => a + b);

  const voters: {
    [k: number]: string[];
  } = Object.fromEntries(poll.options.map((_, idx) => [idx, []]));

  await Promise.all(
    options.map(async (_, idx) => {
      const votes = votesByOption[idx];

      await Promise.all(
        votes.map(async (vote) => {
          const chatMember = await Bot.Client.getChatMember(
            chatId,
            parseInt(vote.tgId, 10)
          );
          const {
            user: { first_name }
          } = chatMember;
          const { balance } = vote;

          if (showBalance) {
            voters[idx].push(
              chatMember
                ? `${first_name} ${balance.toFixed(2)}\n`
                : `Unknown_User ${balance.toFixed(2)}\n`
            );
          } else {
            voters[idx].push(chatMember ? `${first_name}\n` : `Unknown_User\n`);
          }
        })
      );
    })
  );

  const percentages = options.map((_, idx) => {
    const perc =
      votesByOption[idx].length > 0
        ? (votesForEachOption[idx] / allVotes) * 100
        : 0;

    return Number.isInteger(perc) ? perc : perc.toFixed(2);
  });

  options
    .map(
      (option, idx) =>
        `▫️ ${option} - ${
          Number.isInteger(percentages[idx])
            ? percentages[idx]
            : (+percentages[idx]).toFixed(2)
        }%\n${voters[idx].join("")}`
    )
    .join("\n");

  const optionsText = options
    .map(
      (option, idx) =>
        `${String.fromCharCode("a".charCodeAt(0) + idx)}) ${option}`
    )
    .join("\n");

  const perc = [10, 69, 15, 16];

  const barChart = options
    .map(
      (_, idx) =>
        `${String.fromCharCode("a".charCodeAt(0) + idx)}) ${"█".repeat(
          +perc[idx] / 10
        )} - ${perc[idx]}%`
    )
    .join("\n");

  return `Results for poll #${id}:\n\n${optionsText}\n\n${barChart}`;
};

const pollBuildResponse = async (userId: number): Promise<boolean> => {
  switch (pollStorage.getUserStep(userId)) {
    case undefined:
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

export {
  UnixTime,
  getErrorResult,
  logAxiosResponse,
  extractBackendErrorMessage,
  initPoll,
  sendPollMessage,
  createPollText,
  createVoteListText,
  pollBuildResponse,
  sendPollTokenChooser
};
