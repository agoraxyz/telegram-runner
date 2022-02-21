import axios from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { InlineKeyboardButton, Message, Update } from "typegram";
import dayjs from "dayjs";
import { LevelInfo } from "../api/types";
import Bot from "../Bot";
import { fetchCommunitiesOfUser } from "./common";
import config from "../config";
import logger from "../utils/logger";
import { logAxiosResponse, extractBackendErrorMessage } from "../utils/utils";
import pollStorage from "./pollStorage";

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
      await Bot.Client.getChatMember(
        ctx.message.chat.id,
        Number(ctx.message.from.id)
      )
    ).status;
    if (!(memberStatus === "creator" || memberStatus === "administrator")) {
      ctx.reply("You are not an admin.");
      return;
    }
    if (ctx.message.chat.type !== "supergroup") {
      ctx.reply("Please use this command in a guild.");
    } else if (!pollStorage.getUserStep(ctx.message.from.id)) {
      const userStep = pollStorage.getUserStep(ctx.message.from.id);
      if (userStep) {
        pollStorage.deleteMemory(ctx.message.from.id);
      }

      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "Let's start creating your poll. You can use /reset or /cancel to restart or stop the process any time."
      );

      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "First, send me the question of your poll.",
        {
          reply_markup: { force_reply: true }
        }
      );
      pollStorage.initPoll(
        ctx.message.from.id,
        `${ctx.chat.id}:${ctx.message.message_id}`
      );
      pollStorage.setUserStep(ctx.message.from.id, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

const startPoll = async (ctx: any): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }
    if (pollStorage.getUserStep(ctx.message.from.id) < 4) {
      Bot.Client.sendMessage(
        ctx.message.from.id,
        "A poll must have more than one option. Please send me a second one.",
        {
          reply_markup: { force_reply: true }
        }
      );
      return;
    }
    const pollId = pollStorage.getPollId(ctx.message.from.id);
    const poll = pollStorage.getPoll(pollId);
    const chatId = pollId.split(";").pop().split(":")[0];

    const buttons: { text: string; callback_data: string }[] = [];

    let pollText = `${poll.question}\n`;

    poll.options.forEach((option) => {
      pollText = `${pollText}-${option}: 0% = 0 \n`;
      const button = {
        text: option,
        callback_data: `${option};${pollId}`
      };
      buttons.push(button);
    });

    const duration = poll.date.split(":");

    const startDate = dayjs().format("YYYY-MM-DDTHH:mm");
    const expDate = dayjs()
      .add(parseInt(duration[0], 10), "day")
      .add(parseInt(duration[1], 10), "hour")
      .add(parseInt(duration[2], 10), "minute")
      .format("YYYY-MM-DDTHH:mm");

    const res = await axios.post(
      `${config.backendUrl}/tgPoll`,
      {
        pollId,
        question: poll.question,
        startDate,
        expDate,
        options: poll.options
      },
      { timeout: 150000 }
    );

    const voteButtons = { reply_markup: { inline_keyboard: [buttons] } };

    pollStorage.deleteMemory(ctx.message.from.id);

    await Bot.Client.sendMessage(chatId, pollText, voteButtons);
    logAxiosResponse(res);
  } catch (err) {
    pollStorage.deleteMemory(ctx.message.from.id);
    Bot.Client.sendMessage(
      ctx.message.from.id,
      "Something went wrong. Please try again or contact us."
    );

    const rerrorMessage = extractBackendErrorMessage(err);
    if (rerrorMessage === "Poll can't be created for this guild.") {
      await Bot.Client.sendMessage(ctx.message.from.id, rerrorMessage);
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
      const pollId = pollStorage.getPollId(ctx.message.from.id);
      pollStorage.deleteMemory(ctx.message.from.id);
      pollStorage.initPoll(ctx.message.from.id, pollId);
      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "The poll creation process has been reset. Now you can create a new poll. " +
          "If you want to create a poll for a different group, use /cancel instead."
      );
      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "First, send me the question of your poll.",
        {
          reply_markup: { force_reply: true }
        }
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
