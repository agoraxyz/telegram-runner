import axios from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { InlineKeyboardButton, Message, Update } from "typegram";
import dayjs from "dayjs";
import { LevelInfo } from "../api/types";
import Bot from "../Bot";
import { fetchCommunitiesOfUser } from "./common";
import config from "../config";
import logger from "../utils/logger";
import {
  extractBackendErrorMessage,
  logAxiosResponse,
  pollBildResponse
} from "../utils/utils";
import pollStorage from "./pollStorage";
import { Poll } from "./types";

const helpCommand = (ctx: any): void => {
  const helpHeader =
    "Hello there! My name is Medousa.\n" +
    "I'm part of the [Agora](https://agora.xyz/) project and " +
    "I am your personal assistant.\n" +
    "I will always let you know whether you can join a guild or " +
    "whether you were kicked from a guild.\n";

  let commandsList =
    "/help - show instructions\n" +
    "/ping - check if I'm alive\n" +
    "/status - update your roles on every community\n";

  const helpFooter =
    "For more details about me read the documentation on " +
    "[github](https://github.com/agoraxyz/telegram-runner).";

  // DM
  if (ctx.message.chat.id >= 0) {
    commandsList +=
      "/list - get a list of your communities' websites\n" +
      "/leave - you have to choose which community you want " +
      "to leave and I'll do the rest\n";
  }
  // group chat
  else {
    commandsList += "/groupid - shows the ID of the group";
  }

  ctx.replyWithMarkdown(`${helpHeader}\n${commandsList}\n${helpFooter}`, {
    disable_web_page_preview: true
  });
};

const leaveCommand = async (ctx: any): Promise<void> => {
  try {
    const platformUserId = ctx.message.from.id;
    const res = await axios.get(
      `${config.backendUrl}/user/getUserCommunitiesByTelegramId/${platformUserId}`
    );

    logAxiosResponse(res);

    if (ctx.message.chat.id > 0 && res.data.length > 0) {
      const communityList: InlineKeyboardButton[][] = res.data.map(
        (comm: { id: string; name: string }) => [
          Markup.button.callback(
            comm.name,
            `leave_confirm_${comm.id}_${comm.name}`
          )
        ]
      );

      await ctx.replyWithMarkdown(
        "Choose the community you want to leave from the list below:",
        Markup.inlineKeyboard(communityList)
      );
    } else {
      await ctx.reply("You are not a member of any community.");
    }
  } catch (err) {
    logger.error(err);
  }
};

const listCommunitiesCommand = async (ctx: any): Promise<void> => {
  try {
    const results = await fetchCommunitiesOfUser(ctx.message.from.id);

    await ctx.replyWithMarkdown(
      "Please visit your communities' websites:",
      Markup.inlineKeyboard(
        results.map((res) => [Markup.button.url(res.name, res.url)])
      )
    );
  } catch (err) {
    logger.error(err);
  }
};

const pingCommand = async (ctx: any): Promise<void> => {
  const { message } = ctx.update;
  const messageTime = new Date(message.date * 1000).getTime();
  const platformUserId = message.from.id;

  const currTime = new Date().getTime();

  try {
    const sender = await Bot.Client.getChatMember(
      platformUserId,
      platformUserId
    );

    await ctx.replyWithMarkdown(
      `Pong. @${sender.user.username} latency is ${currTime - messageTime}ms.` +
        ` API latency is ${new Date().getTime() - currTime}ms.`
    );
  } catch (err) {
    logger.error(err);
  }
};

const statusUpdateCommand = async (ctx: any): Promise<void> => {
  const { message } = ctx.update;
  const platformUserId = message.from.id;
  try {
    await ctx.reply(
      "I'll update your community accesses as soon as possible. (It could take up to 2 minutes.)"
    );

    const res = await axios.post(
      `${config.backendUrl}/user/statusUpdate/`,
      {
        telegramId: platformUserId
      },
      { timeout: 150000 }
    );
    if (typeof res.data !== "string") {
      await ctx.reply(
        "Currently you should get access to these Communities below: "
      );
      await Promise.all(
        res.data.map(async (c: LevelInfo) => {
          await ctx.reply(
            `Community Name: ${c.name}, Levels: ${c.levels.join()}`
          );
        })
      );
    } else {
      await ctx.reply("There is no such User with this telegramId.");
    }
    logAxiosResponse(res);
  } catch (err) {
    logger.error(err);
  }
};

const groupIdCommand = async (ctx: any): Promise<void> =>
  ctx.reply(ctx.update.message.chat.id, {
    reply_to_message_id: ctx.update.message.message_id
  });

const addCommand = async (
  ctx: NarrowedContext<
    Context,
    {
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }
  >
): Promise<void> => {
  await ctx.replyWithMarkdown(
    "Click to add Medusa bot to your group",
    Markup.inlineKeyboard([
      Markup.button.url(
        "Add Medusa",
        "https://t.me/AgoraMatterBridgerBot?startgroup=true"
      )
    ])
  );
};

const newPoll = async (ctx: any): Promise<void> => {
  try {
    const memberStatus = (
      await Bot.Client.getChatMember(ctx.message.chat.id, ctx.message.from.id)
    ).status;

    if (ctx.message.chat.type !== "supergroup") {
      ctx.reply("Please use this command in a guild.");
      return;
    }

    if (!(memberStatus === "creator" || memberStatus === "administrator")) {
      ctx.reply("You are not an admin.");
      return;
    }

    const userStep = pollStorage.getUserStep(ctx.message.from.id);
    if (userStep) {
      pollStorage.deleteMemory(ctx.message.from.id);
    }

    await Bot.Client.sendMessage(
      ctx.message.from.id,
      "Let's start creating your poll. You can use /reset or /cancel to restart or stop the process any time.\n\n" +
        "First, send me the question of your poll."
    );

    pollStorage.initPoll(ctx.message.from.id, ctx.chat.id.toString());
    pollStorage.setUserStep(ctx.message.from.id, 1);
  } catch (err) {
    logger.error(err);
  }
};

const startPoll = async (ctx: any): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }
    if (await pollBildResponse(ctx.message.from.id)) {
      return;
    }
    const poll = pollStorage.getPoll(ctx.message.from.id);
    const { chatId } = poll;

    // for testing
    logger.verbose(`chat: ${chatId}`);
    logger.verbose(`poll: ${JSON.stringify(poll)}`);

    const voteButtonRow: { text: string; callback_data: string }[][] = [];

    const duration = poll.date.split(":");

    // for testing
    logger.verbose(`duration: ${duration}`);

    const startDate = dayjs().unix();
    const expDate = dayjs()
      .add(parseInt(duration[0], 10), "day")
      .add(parseInt(duration[1], 10), "hour")
      .add(parseInt(duration[2], 10), "minute")
      .unix();

    // for testing
    logger.verbose(`startDate: ${startDate}`);
    logger.verbose(`expDate: ${expDate}`);

    const res = await axios.post(
      `${config.backendUrl}/poll`,
      {
        groupId: poll.chatId,
        question: poll.question,
        startDate,
        expDate,
        options: poll.options
      },
      { timeout: 150000 }
    );

    logAxiosResponse(res);

    const storedPoll: Poll = res.data;

    let pollText = `${poll.question}\n\n`;

    poll.options.forEach((option) => {
      pollText = `${pollText}${option}\n▫️0%\n\n`;
      const button = [
        {
          text: option,
          callback_data: `${option};${storedPoll.id};Vote`
        }
      ];
      voteButtonRow.push(button);
    });
    pollText = pollText.concat(`👥 0 person voted so far.`);

    pollText = pollText.concat(
      `\n\nPoll ends on ${dayjs
        .unix(expDate)
        .utc()
        .format("YYYY-MM-DD HH:mm UTC")}`
    );

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: voteButtonRow
      }
    };

    const message = await Bot.Client.sendMessage(
      chatId,
      pollText,
      inlineKeyboard
    );

    const listVotersButton = {
      text: "List Voters",
      callback_data: `${message.chat.id}:${message.message_id};${storedPoll.id};ListVoters`
    };
    const updateResultButton = {
      text: "Update Result",
      callback_data: `${message.chat.id}:${message.message_id};${storedPoll.id};UpdateResult`
    };

    const adminMessage = await Bot.Client.sendMessage(
      ctx.message.from.id,
      pollText,
      {
        reply_markup: {
          inline_keyboard: [[listVotersButton, updateResultButton]]
        }
      }
    );

    const pollTextRes = await axios.post(
      `${config.backendUrl}/poll/pollText`,
      {
        pollId: storedPoll.id,
        adminTextId: `${ctx.message.from.id}:${adminMessage.message_id}`
      },
      { timeout: 150000 }
    );

    logAxiosResponse(pollTextRes);

    pollStorage.deleteMemory(ctx.message.from.id);
  } catch (err) {
    pollStorage.deleteMemory(ctx.message.from.id);
    Bot.Client.sendMessage(
      ctx.message.from.id,
      "Something went wrong. Please try again or contact us."
    );
    const errorMessage = extractBackendErrorMessage(err);
    if (errorMessage === "Poll can't be created for this guild.") {
      await Bot.Client.sendMessage(ctx.message.from.id, errorMessage);
    }
    logger.error(err);
  }
};

const resetPoll = async (ctx: any): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }
    if (pollStorage.getUserStep(ctx.message.from.id) > 0) {
      const poll = pollStorage.getPoll(ctx.message.from.id);
      pollStorage.deleteMemory(ctx.message.from.id);
      pollStorage.initPoll(ctx.message.from.id, poll.chatId);
      pollStorage.setUserStep(ctx.message.from.id, 1);
      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "The poll creation process has been reset. Now you can create a new poll. " +
          "If you want to create a poll for a different group, use /cancel instead. \n\n" +
          "First, send me the question of your poll."
      );
    }
  } catch (err) {
    logger.error(err);
  }
};

const cancelPoll = async (ctx: any): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }
    if (pollStorage.getUserStep(ctx.message.from.id) > 0) {
      pollStorage.deleteMemory(ctx.message.from.id);
      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "The poll creation process has been cancelled. Use /poll to create a new poll."
      );
    }
  } catch (err) {
    logger.error(err);
  }
};

export {
  helpCommand,
  leaveCommand,
  listCommunitiesCommand,
  pingCommand,
  statusUpdateCommand,
  groupIdCommand,
  addCommand,
  newPoll,
  startPoll,
  resetPoll,
  cancelPoll
};
