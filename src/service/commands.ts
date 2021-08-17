import axios from "axios";
import { Markup } from "telegraf";
import { InlineKeyboardButton } from "typegram";
import Bot from "../Bot";
import { fetchCommunitiesOfUser } from "./common";
import config from "../config";
import logger from "../utils/logger";
import { getUserHash, logAxiosResponse } from "../utils/utils";
import { LevelInfo } from "../api/types";

const helpCommand = (ctx: any): void => {
  const helpHeader =
    "Hello there! My name is Medousa.\n" +
    "I'm part of the [Agora](https://agora-space.vercel.app/) project and " +
    "I am your personal assistant.\n" +
    "I will always let you know whether you can join a higher group or " +
    "whether you were kicked from a group.\n";

  let commandsList =
    "/help - show instructions\n/ping - check if I'm alive\n/status - update your roles on every community\n";

  const helpFooter =
    "For more details about me read the documentation on " +
    "[github](https://github.com/AgoraSpaceDAO/telegram-runner).";

  // DM
  if (ctx.message.chat.id >= 0) {
    commandsList +=
      "/list - get a list of your communities' websites\n" +
      "/leave - you have to choose which community you want " +
      "to leave and I'll do the rest\n";
  }
  // group chat
  else {
    commandsList += "";
  }

  ctx.replyWithMarkdown(`${helpHeader}\n${commandsList}\n${helpFooter}`, {
    disable_web_page_preview: true
  });
};

const leaveCommand = async (ctx: any): Promise<void> => {
  try {
    const platformUserId = `${ctx.message.from.id}`;
    const userHash = await getUserHash(platformUserId);
    logger.verbose(`leaveCommand userHash - ${userHash}`);

    const res = await axios.get(
      `${config.backendUrl}/user/getUserCommunitiesByTelegramId/${userHash}`
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
  const platformUserId = `${message.from.id}`;
  try {
    await ctx.reply(
      "I'll update your community accesses as soon as possible. (It could take up to 2 minutes.)"
    );
    const userHash = await getUserHash(platformUserId);
    logger.verbose(`statusUpdateCommand userHash - ${userHash}`);

    const res = await axios.post(
      `${config.backendUrl}/user/statusUpdate/`,
      {
        telegramId: userHash
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

export {
  helpCommand,
  leaveCommand,
  listCommunitiesCommand,
  pingCommand,
  statusUpdateCommand
};
