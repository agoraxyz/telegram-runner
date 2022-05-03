import axios, { AxiosResponse } from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ErrorResult } from "../api/types";
import Bot from "../Bot";
import config from "../config";
import pollStorage from "../service/pollStorage";
import { Ctx, Poll } from "../service/types";
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
  ctx: Ctx,
  platformUserId: number,
  guildId: number
): Promise<void> => {
  const guildRes = await axios.get(`${config.backendUrl}/guild/${guildId}`);

  const guild = guildRes?.data;

  if (!guild) {
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
    const { name, chain, id } = requirement;

    return [
      {
        text: `${name} on ${chain}`,
        callback_data: `${name}-${chain};${id};ChooseRequirement`
      }
    ];
  });

  const group = (await ctx.getChat()) as { title: string };

  await Bot.Client.sendMessage(
    platformUserId,
    "You are creating a token-weighted emoji-based poll in the " +
      `channel "${group.title}" of the guild "${guild.name}".\n\n` +
      "You can use /reset or /cancel to restart or stop the process at any time.\n" +
      "Don't worry, I will guide you through the whole process.\n\n" +
      "First, please choose a token as the base of the weighted poll.",
    {
      reply_markup: {
        inline_keyboard: tokenButtons
      }
    }
  );
};

const initPoll = async (ctx: any): Promise<void> => {
  const { update } = ctx;

  let chatId: number;
  let userId;

  try {
    if (update.channel_post) {
      chatId = update.channel_post.chat.id;

      const creatorId = (await Bot.Client.getChatAdministrators(chatId))
        .filter((admin) => admin.status === "creator")
        .map((admin) => admin.user.id)[0];

      userId = String(creatorId);
    } else {
      chatId = update.message.chat.id;
      userId = update.message.from.id;
    }

    const chatMember = await Bot.Client.getChatMember(chatId, userId);

    const guildIdRes = await axios.get(
      `${config.backendUrl}/guild/platformId/${chatId}`
    );

    const guildId = guildIdRes?.data?.id;

    if (!guildId) {
      await ctx.reply("Please use this command in a guild.");

      return;
    }

    const isAdminRes = await axios.get(
      `${config.backendUrl}/guild/isAdmin/${chatId}/${userId}`
    );

    if (isAdminRes?.data) {
      await sendPollTokenChooser(ctx, userId, guildIdRes.data.id);

      if (pollStorage.getPoll(userId)) {
        await ctx.reply(
          "You already have an ongoing poll creation process.\n" +
            "You can cancel it using /cancel."
        );

        return;
      }

      pollStorage.initPoll(userId, chatId.toString());

      if (update.channel_post) {
        return;
      }

      if (!chatMember) {
        await ctx.reply("Check your private messages!");

        return;
      }

      const { username, first_name } = chatMember.user;

      if (!username) {
        await ctx.replyWithMarkdown(
          `[${first_name}](tg://user?id=${userId}) please check your private messages!`
        );

        return;
      }

      await ctx.reply(`@${username} please check your private messages!`);
    } else {
      ctx.reply("Seems like you are not a guild admin.");
    }
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
    `**Poll #${id}: ${question}**\n\n` +
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

const pollBuildResponse = async (userId: number): Promise<boolean> => {
  const poll = pollStorage.getPoll(userId);

  if (poll) {
    if (poll.requirementId === 0) {
      await Bot.Client.sendMessage(
        userId,
        "You must choose a token for weighting."
      );

      return true;
    }

    if (poll.question === "") {
      await Bot.Client.sendMessage(userId, "The poll must have a question.");

      return true;
    }

    if (poll.options.length <= 1) {
      await Bot.Client.sendMessage(
        userId,
        "The poll must have at least two options."
      );

      return true;
    }

    if (poll.expDate === "") {
      await Bot.Client.sendMessage(
        userId,
        "The poll must have an expriation date."
      );

      return true;
    }
  } else {
    await Bot.Client.sendMessage(
      userId,
      "You don't have an active poll creation process."
    );

    return true;
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
  pollBuildResponse,
  sendPollTokenChooser
};
