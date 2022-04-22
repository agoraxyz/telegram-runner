import axios, { AxiosResponse } from "axios";
import { Markup } from "telegraf";
import { InlineKeyboardButton } from "typegram";
import dayjs from "dayjs";
import { LevelInfo } from "../api/types";
import Bot from "../Bot";
import { generateInvite } from "../api/actions";
import { fetchCommunitiesOfUser, getGroupName } from "./common";
import config from "../config";
import logger from "../utils/logger";
import {
  sendPollTokenChooser,
  extractBackendErrorMessage,
  pollBuildResponse,
  initPoll
} from "../utils/utils";
import pollStorage from "./pollStorage";
import { Ctx } from "./types";

const helpCommand = (ctx: Ctx): void => {
  const helpHeader =
    "Hello there! I'm the Guild bot.\n" +
    "I'm part of the [Guild](https://docs.guild.xyz/) project and " +
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

const startCommand = async (ctx: Ctx): Promise<void> => {
  const { message } = ctx;

  if (message.chat.id > 0) {
    const refIdRegex = /^\/start [a-z0-9]{64}$/;

    if (refIdRegex.test(message.text)) {
      const refId = message.text.split("/start ")[1];
      const platformUserId = message.from.id;

      try {
        await ctx.reply(
          "Thank you for joining, I'll send the invites as soon as possible."
        );

        let res: AxiosResponse;

        logger.verbose(`onChatStart join - ${refId} ${platformUserId}`);

        try {
          res = await axios.post(
            `${config.backendUrl}/telegram/accessibleGroups`,
            {
              refId,
              platformUserId
            }
          );
        } catch (error) {
          if (error?.response?.data?.errors?.[0]?.msg === "deleted") {
            ctx.reply(
              "This invite link has expired. Please, start the joining process through the guild page again."
            );
            return;
          }

          logger.error(`${JSON.stringify(error)}`);

          ctx.reply(`Something went wrong. (${new Date().toUTCString()})`);

          return;
        }

        if (res.data.length === 0) {
          ctx.reply(
            "There aren't any groups of this guild that you have access to."
          );

          return;
        }

        const invites: { link: string; name: string }[] = [];

        await Promise.all(
          res.data.map(async (groupId: string) => {
            const inviteLink = await generateInvite(groupId, platformUserId);

            if (inviteLink !== undefined) {
              invites.push({
                link: inviteLink,
                name: await getGroupName(+groupId)
              });
            }
          })
        );

        logger.verbose(`inviteLink: ${invites}`);

        if (invites.length) {
          ctx.replyWithMarkdown(
            "Use the following invite links to join the groups you unlocked:",
            Markup.inlineKeyboard(
              invites.map((inv) => [Markup.button.url(inv.name, inv.link)])
            )
          );
        } else {
          ctx.reply(
            "You are already a member of the groups of this guild so you will not receive any invite links."
          );
        }
      } catch (err) {
        logger.error(err);
      }
    } else {
      helpCommand(ctx);
    }
  }
};

const leaveCommand = async (ctx: Ctx): Promise<void> => {
  try {
    const platformUserId = ctx.message.from.id;

    const res = await axios.get(
      `${config.backendUrl}/user/getUserCommunitiesByTelegramId/${platformUserId}`
    );

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

const listCommunitiesCommand = async (ctx: Ctx): Promise<void> => {
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

const pingCommand = async (ctx: Ctx): Promise<void> => {
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

const statusUpdateCommand = async (ctx: Ctx): Promise<void> => {
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
  } catch (err) {
    logger.error(err);
  }
};

const groupIdCommand = async (ctx: Ctx): Promise<void> => {
  ctx.reply(String(ctx.update.message.chat.id), {
    reply_to_message_id: ctx.update.message.message_id
  });
};

const addCommand = async (ctx: Ctx): Promise<void> => {
  ctx.replyWithMarkdown(
    "Click to add Guild bot to your group",
    Markup.inlineKeyboard([
      Markup.button.url(
        "Add Guild bot",
        "https://t.me/Guildxyz_bot?startgroup=true"
      )
    ])
  );
};

const pollCommand = async (ctx: Ctx): Promise<void> => {
  initPoll(ctx);
};

const doneCommand = async (ctx: Ctx): Promise<void> => {
  const userId = ctx.message.from.id;

  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }

    if (await pollBuildResponse(userId)) {
      return;
    }

    const poll = pollStorage.getPoll(userId);
    const duration = poll.expDate.split(":");
    const startDate = dayjs().unix();
    const expDate = dayjs()
      .add(parseInt(duration[0], 10), "day")
      .add(parseInt(duration[1], 10), "hour")
      .add(parseInt(duration[2], 10), "minute")
      .unix();

    const { platformId, requirementId, question, options } = poll;

    await axios.post(
      `${config.backendUrl}/poll`,
      {
        platform: config.platform,
        platformId,
        requirementId,
        question,
        startDate,
        expDate,
        options
      },
      { timeout: 150000 }
    );

    pollStorage.deleteMemory(userId);
  } catch (err) {
    pollStorage.deleteMemory(userId);
    Bot.Client.sendMessage(
      userId,
      "Something went wrong. Please try again or contact us."
    );

    const errorMessage = extractBackendErrorMessage(err);

    if (errorMessage === "Poll can't be created for this guild.") {
      await Bot.Client.sendMessage(userId, errorMessage);
    }

    logger.error(err);
  }
};

const resetCommand = async (ctx: Ctx): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }

    const platformUserId = ctx.message.from.id;

    if (pollStorage.getUserStep(platformUserId) > 0) {
      const { platformId } = pollStorage.getPoll(platformUserId);

      pollStorage.deleteMemory(platformUserId);
      pollStorage.initPoll(platformUserId, platformId);
      pollStorage.setUserStep(platformUserId, 1);

      const guildIdRes = await axios
        .get(`${config.backendUrl}/guild/platformId/${platformId}`)
        .catch(() => undefined);

      if (!guildIdRes) {
        ctx.reply("Please use this command in a guild.");
        return;
      }

      await Bot.Client.sendMessage(
        platformUserId,
        "The poll building process has been reset."
      );

      await sendPollTokenChooser(ctx, platformUserId, guildIdRes.data.id);
    }
  } catch (err) {
    logger.error(err);
  }
};

const cancelCommand = async (ctx: Ctx): Promise<void> => {
  try {
    if (ctx.message.chat.type !== "private") {
      return;
    }

    const userId = ctx.message.from.id;

    if (pollStorage.getUserStep(userId) > 0) {
      pollStorage.deleteMemory(userId);

      await Bot.Client.sendMessage(
        userId,
        "The poll creation process has been cancelled. Use /poll to create a new poll."
      );
    }
  } catch (err) {
    logger.error(err);
  }
};

export {
  helpCommand,
  startCommand,
  leaveCommand,
  listCommunitiesCommand,
  pingCommand,
  statusUpdateCommand,
  groupIdCommand,
  addCommand,
  pollCommand,
  doneCommand,
  resetCommand,
  cancelCommand
};
