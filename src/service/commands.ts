import axios, { AxiosResponse } from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { InlineKeyboardButton, Message, Update } from "typegram";
import dayjs from "dayjs";
import { LevelInfo } from "../api/types";
import Bot from "../Bot";
import { generateInvite } from "../api/actions";
import { fetchCommunitiesOfUser, getGroupName } from "./common";
import config from "../config";
import logger from "../utils/logger";
import {
  sendPollTokenPicker,
  extractBackendErrorMessage,
  logAxiosResponse,
  pollBildResponse,
  createVoteListText
} from "../utils/utils";
import pollStorage from "./pollStorage";
import { Poll } from "./types";

const helpCommand = (ctx: any): void => {
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

const onChatStart = async (
  ctx: NarrowedContext<
    Context,
    {
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }
  > & { startPayload?: string }
): Promise<void> => {
  const { message } = ctx;

  if (ctx.startPayload !== undefined && ctx.startPayload.includes("voters_")) {
    const [, pollId, chatId] = ctx.startPayload.split("_");
    console.log("list voters: ", pollId);
    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);
    logAxiosResponse(pollResponse);
    if (pollResponse.data.length === 0) {
      await ctx.reply("Failed to fetch voters");
    }

    const poll = pollResponse.data;

    const responseText = await createVoteListText(chatId, poll, false);

    await ctx.reply(responseText);
    return;
  }

  if (message.chat.id > 0) {
    if (new RegExp(/^\/start [a-z0-9]{64}$/).test(message.text)) {
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
            `${config.backendUrl}/user/getAccessibleGroupIds`,
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
        logAxiosResponse(res);

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
            "You are already a member of the groups of this guild " +
              "so you will not receive any invite links."
          );
        }
      } catch (err) {
        logger.error(err);
      }
    } else helpCommand(ctx);
  }
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
    "Click to add Guild bot to your group",
    Markup.inlineKeyboard([
      Markup.button.url(
        "Add Guild bot",
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

    const guildIdRes = await axios
      .get(`${config.backendUrl}/guild/platformId/${ctx.message.chat.id}`)
      .catch(() => undefined);

    if (!guildIdRes) {
      ctx.reply("Please use this command in a guild.");
      return;
    }

    if (!(memberStatus === "creator" || memberStatus === "administrator")) {
      ctx.reply("You are not an admin.");
      return;
    }

    await sendPollTokenPicker(ctx, guildIdRes.data.id);

    const userStep = pollStorage.getUserStep(ctx.message.from.id);
    if (userStep) {
      pollStorage.deleteMemory(ctx.message.from.id);
    }

    pollStorage.initPoll(ctx.message.from.id, ctx.chat.id.toString());
    pollStorage.setUserStep(ctx.message.from.id, 1);

    const ChatMember = await Bot.Client.getChatMember(
      ctx.chat.id,
      ctx.message.from.id
    ).catch(() => undefined);

    if (!ChatMember) {
      ctx.reply("Check your private messages!");
    } else {
      const userName = ChatMember.user.username;
      if (!userName) {
        ctx.replyWithMarkdown(
          `[${ChatMember.user.first_name}](tg://user?id=${ctx.message.from.id}) check your private messages!`
        );
      } else {
        ctx.reply(`@${userName} check your private messages!`);
      }
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
        requirementId: poll.requirementId,
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

    const adminMessage = await Bot.Client.sendMessage(
      ctx.message.from.id,
      pollText
    );

    poll.options.forEach((option) => {
      pollText = `${pollText}${option}\n▫️0%\n\n`;
      const button = [
        {
          text: option,
          callback_data: `${option};${storedPoll.id};${ctx.message.from.id}:${adminMessage.message_id};Vote`
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

    await Bot.Client.editMessageText(
      ctx.message.from.id,
      adminMessage.message_id,
      undefined,
      pollText,
      {
        reply_markup: {
          inline_keyboard: [[listVotersButton, updateResultButton]]
        }
      }
    );

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

      const guildIdRes = await axios
        .get(`${config.backendUrl}/guild/platformId/${poll.chatId}`)
        .catch(() => undefined);

      if (!guildIdRes) {
        ctx.reply("Please use this command in a guild.");
        return;
      }

      await Bot.Client.sendMessage(
        ctx.message.from.id,
        "The poll building process has been reset."
      );

      await sendPollTokenPicker(ctx, guildIdRes.data.id);
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
  onChatStart,
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
