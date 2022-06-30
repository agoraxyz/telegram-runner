import axios, { AxiosResponse } from "axios";
import { Markup } from "telegraf";
import { InlineKeyboardButton } from "telegraf/types";
import dayjs from "dayjs";
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
import Main from "../Main";

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

        logger.verbose({
          message: "startCommand",
          meta: { platformUserId, refId }
        });

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

        logger.verbose({ message: "invites", meta: { invites } });

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
    const sender = await Bot.client.getChatMember(
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
      "I'll update your community accesses as soon as possible. (It could take up to 1 minute.)"
    );

    const statusResponse = await Main.platform.user.status(
      platformUserId.toString()
    );

    let replyMsg: string;
    if (statusResponse?.length === 0) {
      replyMsg =
        "It looks like you haven't joined any guilds that gate Telegram.";
    } else {
      replyMsg = `Currently you should have access to these groups:\n${statusResponse
        .map((sr) => sr.platformGuildName || sr.platformGuildName)
        .join("\n")}`;
    }

    await ctx.reply(replyMsg);
  } catch (err) {
    await ctx.reply(
      `Cannot update your status. (${err.message})\nJoined any guilds?`
    );
    logger.error(err);
  }
};

const groupIdCommand = async (ctx: Ctx): Promise<void> => {
  ctx.replyWithMarkdown(`\`${ctx.update.message.chat.id}\``, {
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

const enoughCommand = async (ctx: Ctx): Promise<void> => {
  const msg = ctx.message;
  const userId = msg.from.id;

  if (msg.chat.type === "private") {
    const poll = pollStorage.getPoll(userId);

    if (poll) {
      if (pollStorage.getUserStep(userId) === 3 && poll.options.length >= 2) {
        pollStorage.setUserStep(userId, 4);

        ctx.reply(
          "Please give me the duration of the poll in the DD:HH:mm format (days:hours:minutes)"
        );
      } else {
        ctx.reply("You didn't finish the previous steps.");
      }
    } else {
      ctx.reply("You don't have an active poll creation process.");
    }
  } else {
    ctx.reply("Please use this command in private");
  }
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

    if (poll) {
      const startDate = dayjs().unix();

      await axios.post(
        `${config.backendUrl}/poll`,
        {
          platform: config.platform,
          startDate,
          ...poll
        },
        { timeout: 150000 }
      );

      pollStorage.deleteMemory(userId);

      await Bot.client.sendMessage(userId, "The poll has been created.");
    } else {
      ctx.reply("You don't have an active poll creation process.");
    }
  } catch (err) {
    pollStorage.deleteMemory(userId);

    await Bot.client.sendMessage(
      userId,
      "There was an error while creating the poll."
    );

    const errorMessage = extractBackendErrorMessage(err);

    if (errorMessage === "Poll can't be created for this guild.") {
      await Bot.client.sendMessage(userId, errorMessage);
    }

    logger.error(err);
  }
};

const resetCommand = async (ctx: Ctx): Promise<void> => {
  const userId = ctx.message.from.id;

  try {
    if (pollStorage.getUserStep(userId) > 0) {
      const { platformId } = pollStorage.getPoll(userId);

      pollStorage.deleteMemory(userId);
      pollStorage.initPoll(userId, platformId);
      pollStorage.setUserStep(userId, 1);

      const guildIdRes = await axios.get(
        `${config.backendUrl}/guild/platformId/${platformId}`
      );

      if (!guildIdRes?.data) {
        await ctx.reply("Please use this command in a guild.");

        return;
      }

      await Bot.client.sendMessage(
        userId,
        "The current poll creation procedure has been restarted."
      );

      await sendPollTokenChooser(ctx, userId, guildIdRes.data.id);
    } else {
      await Bot.client.sendMessage(
        userId,
        "You don't have an active poll creation process."
      );
    }
  } catch (err) {
    logger.error(err);
  }
};

const cancelCommand = async (ctx: Ctx): Promise<void> => {
  const userId = ctx.message.from.id;

  try {
    if (pollStorage.getPoll(userId)) {
      pollStorage.deleteMemory(userId);

      await Bot.client.sendMessage(
        userId,
        "The current poll creation process has been cancelled."
      );
    } else {
      await Bot.client.sendMessage(
        userId,
        "You don't have an active poll creation process."
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
  enoughCommand,
  doneCommand,
  resetCommand,
  cancelCommand
};
