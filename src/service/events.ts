import axios from "axios";
import { Context, NarrowedContext } from "telegraf";
import { Update } from "telegraf/types";
import dayjs from "dayjs";
import Bot from "../Bot";
import {
  sendMessageForSupergroup,
  sendNotASuperGroup,
  sendNotAnAdministrator,
  fetchCommunitiesOfUser,
  leaveCommunity,
  kickUser
} from "./common";
import config from "../config";
import logger from "../utils/logger";
import { createPollText, initPoll } from "../utils/utils";
import pollStorage from "./pollStorage";
import { Poll } from "./types";

const messageUpdate = async (
  ctx: NarrowedContext<Context, Update.MessageUpdate>
): Promise<void> => {
  const msg = ctx.update.message as {
    chat: { id: number; type: string };
    from: { id: number };
    text: string;
  };

  if (msg.chat.type === "private") {
    try {
      const userId = msg.from.id;
      const messageText = msg.text.trim();

      switch (pollStorage.getUserStep(userId)) {
        case 1: {
          pollStorage.savePollQuestion(userId, messageText);

          const buttons = [
            [
              {
                text: "Yes",
                callback_data: "desc;yes"
              },
              {
                text: "No",
                callback_data: "desc;no"
              }
            ]
          ];

          await ctx.reply("Do you want to add a description for the poll?", {
            reply_markup: {
              inline_keyboard: buttons
            }
          });

          return;
        }

        case 2: {
          pollStorage.savePollDescription(userId, messageText);
          pollStorage.setUserStep(userId, 3);

          await ctx.reply("Please give me the first option of your poll.");

          return;
        }

        case 3: {
          const optionSaved = pollStorage.savePollOption(userId, messageText);

          if (!optionSaved) {
            await ctx.reply("This option has already been added.");

            return;
          }

          if (pollStorage.getPoll(userId).options.length === 1) {
            await ctx.reply("Please give me the second option of your poll.");
          } else {
            await ctx.reply(
              "Please give me a new option or go to the next step by using /enough"
            );
          }

          return;
        }

        case 4: {
          const dateRegex =
            /([1-9][0-9]*|[0-9]):([0-1][0-9]|[0-9]|[2][0-4]):([0-5][0-9]|[0-9])/;
          const found = messageText.match(dateRegex);

          if (!found) {
            await ctx.reply(
              "The message you sent me is not in the DD:HH:mm format.\n" +
                "Please verify the contents of your message and send again."
            );

            return;
          }

          const [day, hour, minute] = found[0].split(":");

          const expDate = dayjs()
            .add(parseInt(day, 10), "day")
            .add(parseInt(hour, 10), "hour")
            .add(parseInt(minute, 10), "minute")
            .unix()
            .toString();

          pollStorage.savePollExpDate(userId, expDate);
          pollStorage.setUserStep(userId, 4);

          const poll = {
            id: 69,
            ...pollStorage.getPoll(userId)
          } as unknown as Poll;

          await ctx.replyWithMarkdown(await createPollText(poll));

          await ctx.reply(
            "You can accept it by using /done,\n" +
              "reset the data by using /reset\n" +
              "or cancel it using /cancel."
          );

          return;
        }

        default: {
          break;
        }
      }

      await ctx.replyWithMarkdown(
        "I'm sorry, but I couldn't interpret your request.\n" +
          "You can find more information on [docs.guild.xyz](https://docs.guild.xyz/)."
      );
    } catch (err) {
      logger.error(err);
    }
  }
};

const channelPostUpdate = async (
  ctx: NarrowedContext<Context, Update.ChannelPostUpdate>
): Promise<void> => {
  const post = ctx.update.channel_post as {
    message_id: number;
    chat: { id: number };
    text: string;
  };

  const channelId = post.chat.id;

  switch (post.text) {
    case "/poll": {
      await initPoll(ctx);
      await Bot.client.deleteMessage(channelId, post.message_id);

      break;
    }

    case "/groupid": {
      ctx.reply(
        "You can only use this command in a group.\n" +
          "Please use the /channelid command for groups",
        {
          reply_to_message_id: post.message_id
        }
      );

      break;
    }

    case "/channelid": {
      ctx.replyWithMarkdown(`\`${channelId}\``, {
        reply_to_message_id: post.message_id
      });

      break;
    }

    default: {
      break;
    }
  }
};

const onUserJoined = async (
  platformUserId: number,
  platformGuildId: number
): Promise<void> => {
  try {
    await axios.post(`${config.backendUrl}/user/joinedPlatform`, {
      platformName: config.platform,
      platformUserId,
      platformGuildId
    });
  } catch (err) {
    logger.error(err);
  }
};

const onUserRemoved = async (
  platformUserId: number,
  groupId: string
): Promise<void> => {
  try {
    const res = await axios.post(
      `${config.backendUrl}/user/removeFromPlatform`,
      {
        platform: config.platform,
        platformUserId,
        groupId
      }
    );

    logger.debug(JSON.stringify(res.data));
  } catch (_) {
    logger.error("Failed to remove user from Guild.");
  }
};

const leftChatMemberUpdate = async (
  ctx: NarrowedContext<Context, any>
): Promise<void> => {
  const msg = ctx.update.message;

  if (msg.left_chat_member.id) {
    await onUserRemoved(msg.left_chat_member.id, msg.chat.id);
  }
};

const chatMemberUpdate = async (
  ctx: NarrowedContext<Context, Update.ChatMemberUpdate>
) => {
  const {
    from: { id: userId },
    chat: { id: groupId },
    new_chat_member,
    invite_link: invLink
  } = ctx.update.chat_member;

  if (new_chat_member?.status === "member") {
    try {
      if (invLink) {
        const { invite_link } = invLink;

        const bot = await Bot.client.getMe();

        if (invLink.creator.id === bot.id) {
          logger.verbose({
            message: "onChatMemberUpdate",
            meta: {
              groupId,
              userId,
              invite_link
            }
          });

          onUserJoined(userId, groupId);
        } else {
          kickUser(groupId, userId, "haven't joined through Guild interface!");
        }
      } else {
        kickUser(
          groupId,
          new_chat_member.user.id,
          "have joined the group without using an invite link.\n" +
            "If this is not the case then the admins did not set up the guild properly."
        );
      }
    } catch (err) {
      logger.error(err);
    }
  }
};

const onBlocked = async (
  ctx: NarrowedContext<Context, Update.MyChatMemberUpdate>
): Promise<void> => {
  const platformUserId = ctx.update.my_chat_member.from.id;

  logger.warn(`User "${platformUserId}" has blocked the bot.`);

  try {
    const communities = await fetchCommunitiesOfUser(platformUserId);

    communities.map(async (community) =>
      leaveCommunity(platformUserId, community.id)
    );
  } catch (err) {
    logger.error(err);
  }
};

const myChatMemberUpdate = async (
  ctx: NarrowedContext<Context, Update.MyChatMemberUpdate>
): Promise<void> => {
  const { my_chat_member } = ctx.update;
  const { chat, old_chat_member, new_chat_member } = my_chat_member;

  try {
    if (old_chat_member?.status === "kicked") {
      onBlocked(ctx);
    } else if (
      new_chat_member?.status === "member" ||
      new_chat_member?.status === "administrator"
    ) {
      const groupId = chat.id;

      if (["supergroup", "channel"].includes(chat.type)) {
        if (new_chat_member?.status === "administrator") {
          await sendMessageForSupergroup(groupId);
        } else {
          await sendNotAnAdministrator(groupId);
        }
      } else {
        await sendNotASuperGroup(groupId);
      }
    }
  } catch (err) {
    logger.error(err);
  }
};

export {
  messageUpdate,
  channelPostUpdate,
  onUserJoined,
  leftChatMemberUpdate,
  onUserRemoved,
  chatMemberUpdate,
  myChatMemberUpdate,
  onBlocked
};
