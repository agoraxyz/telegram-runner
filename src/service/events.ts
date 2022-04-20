import axios from "axios";
import { Context, NarrowedContext } from "telegraf";
import { Update } from "typegram";
import Bot from "../Bot";
import {
  sendNotASuperGroup,
  fetchCommunitiesOfUser,
  leaveCommunity,
  sendMessageForSupergroup,
  sendNotAnAdministrator,
  kickUser
} from "./common";
import config from "../config";
import logger from "../utils/logger";
import { initPoll } from "../utils/utils";
import pollStorage from "./pollStorage";

const onMessage = async (
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
      const step = pollStorage.getUserStep(userId);
      const messageText = msg.text.trim();

      if (step === 2) {
        pollStorage.savePollQuestion(userId, messageText);
        pollStorage.setUserStep(userId, 3);

        await Bot.Client.sendMessage(
          userId,
          "Now please send me the duration of your poll in DD:HH:mm format.\n" +
            'For example if you want your poll to be active for 1.5 hours, you should send "0:1:30" or "00:01:30".'
        );
      } else if (step === 3) {
        const dateRegex =
          /([1-9][0-9]*|[0-9]):([0-1][0-9]|[0-9]|[2][0-4]):([0-5][0-9]|[0-9])/;
        const found = messageText.match(dateRegex);

        if (!found) {
          await Bot.Client.sendMessage(
            userId,
            "The message you sent me is not in the DD:HH:mm format. Please verify the contents of your message and send again."
          );
          return;
        }

        const date = found[0];

        pollStorage.savePollExpDate(userId, date);
        pollStorage.setUserStep(userId, 4);

        await Bot.Client.sendMessage(
          userId,
          "Now send me the first option of your poll."
        );
      } else if (step >= 4) {
        const optionSaved = pollStorage.savePollOption(userId, messageText);

        if (!optionSaved) {
          await Bot.Client.sendMessage(
            userId,
            "This option is invalid please send me another."
          );
          return;
        }

        if (step === 4) {
          await Bot.Client.sendMessage(
            userId,
            "Send me the second option of your poll."
          );
        } else if (step >= 5) {
          await Bot.Client.sendMessage(
            userId,
            "You can send me another option or use /done to start and publish your poll."
          );
        }
        pollStorage.setUserStep(userId, step + 1);
      } else {
        await ctx.reply("I'm sorry, but I couldn't interpret your request.");
        await ctx.replyWithMarkdown(
          "You can find more information on the [Guild](https://docs.guild.xyz/) website."
        );
      }
    } catch (err) {
      logger.error(err);
    }
  }
};

const onChannelPost = async (
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
      await Bot.Client.deleteMessage(channelId, post.message_id);

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
      ctx.reply(String(channelId), {
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
  groupId: number
): Promise<void> => {
  try {
    const res = await axios.post(`${config.backendUrl}/user/joinedPlatform`, {
      platform: config.platform,
      platformUserId,
      groupId
    });

    logger.debug(JSON.stringify(res.data));
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
  } catch (err) {
    logger.error(err);
  }
};

const onUserLeftGroup = async (
  ctx: NarrowedContext<Context, any>
): Promise<void> => {
  const msg = ctx.update.message;

  if (msg.left_chat_member.id) {
    await onUserRemoved(msg.left_chat_member.id, msg.chat.id);
  }
};

const onChatMemberUpdate = async (
  ctx: NarrowedContext<Context, Update.ChatMemberUpdate>
) => {
  const member = ctx.update.chat_member;

  if (member.invite_link) {
    const invLink = member.invite_link.invite_link;
    logger.verbose(`join inviteLink ${invLink}`);
    const bot = await Bot.Client.getMe();
    if (member.invite_link.creator.id === bot.id) {
      logger.verbose(
        `function: onChatMemberUpdate, user: ${member.from.id}, ` +
          `chat: ${member.chat.id}, invite: ${invLink}`
      );

      onUserJoined(member.from.id, member.chat.id);
    } else {
      kickUser(
        member.chat.id,
        member.from.id,
        "haven't joined through Guild interface!"
      );
    }
  }
};

const onBlocked = async (
  ctx: NarrowedContext<Context, Update.MyChatMemberUpdate>
): Promise<void> => {
  const platformUserId = ctx.update.my_chat_member.from.id;

  logger.verbose(`User "${platformUserId}" has blocked the bot.`);

  try {
    const communities = await fetchCommunitiesOfUser(platformUserId);

    communities.map(async (community) =>
      leaveCommunity(platformUserId, community.id)
    );
  } catch (err) {
    logger.error(err);
  }
};

const onMyChatMemberUpdate = async (
  ctx: NarrowedContext<Context, Update.MyChatMemberUpdate>
): Promise<void> => {
  try {
    if (ctx.update.my_chat_member.new_chat_member?.status === "kicked") {
      onBlocked(ctx);
    }
    if (
      ctx.update.my_chat_member.new_chat_member?.status === "member" ||
      ctx.update.my_chat_member.old_chat_member?.status === "member"
    ) {
      const groupId = ctx.update.my_chat_member.chat.id;
      if (ctx.update.my_chat_member.chat.type !== "supergroup")
        await sendNotASuperGroup(groupId);
      else if (
        ctx.update.my_chat_member.new_chat_member?.status === "administrator"
      ) {
        await Bot.Client.sendMessage(
          groupId,
          `The Guild Bot has administrator privileges from now! We are ready to roll!`
        );
        await sendMessageForSupergroup(groupId);
      } else await sendNotAnAdministrator(groupId);
    }
  } catch (error) {
    logger.error(`Error while calling onUserJoinedGroup:\n${error}`);
  }
};

export {
  onMessage,
  onChannelPost,
  onUserJoined,
  onUserLeftGroup,
  onUserRemoved,
  onChatMemberUpdate,
  onMyChatMemberUpdate,
  onBlocked
};
