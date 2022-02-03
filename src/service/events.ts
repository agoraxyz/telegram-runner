import axios, { AxiosResponse } from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { Message, Update } from "typegram";
import Bot from "../Bot";
import { generateInvite } from "../api/actions";
import {
  sendNotASuperGroup,
  fetchCommunitiesOfUser,
  getGroupName,
  leaveCommunity,
  sendMessageForSupergroup,
  sendNotAnAdministrator,
  kickUser
} from "./common";
import config from "../config";
import logger from "../utils/logger";
import { logAxiosResponse } from "../utils/utils";

const onMessage = async (ctx: any): Promise<void> => {
  if (ctx.message.chat.id > 0) {
    try {
      await ctx.reply("I'm sorry, but I couldn't interpret your request.");
      await ctx.replyWithMarkdown(
        "You can find more information on the " +
          "[Agora](https://agora.xyz/) website."
      );
    } catch (err) {
      logger.error(err);
    }
  }
};

const onChatStart = async (
  ctx: NarrowedContext<
    Context,
    {
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }
  >
): Promise<void> => {
  const { message } = ctx;

  if (message.chat.id > 0) {
    if (new RegExp(/^\/start [a-z0-9]{64}$/).test(message.text)) {
      const refId = message.text.split("/start ")[1];
      const platformUserId = message.from.id;

      try {
        await ctx.reply(
          "Thank you for joining, I'll send the invites as soon as possible."
        );

        let res: AxiosResponse;
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
    } else onMessage(ctx);
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

    logAxiosResponse(res);

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

    logAxiosResponse(res);

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const onBlocked = async (ctx: any): Promise<void> => {
  const platformUserId = ctx.update.my_chat_member.from.id;

  logger.verbose(`User "${platformUserId}" has blocked the bot.`);

  try {
    const communities = await fetchCommunitiesOfUser(platformUserId);

    communities.forEach((community) =>
      leaveCommunity(platformUserId, community.id)
    );
  } catch (err) {
    logger.error(err);
  }
};

const onUserLeftGroup = async (ctx: any): Promise<void> => {
  if (ctx.update.message.left_chat_member.id) {
    await onUserRemoved(
      ctx.update.message.left_chat_member.id,
      ctx.update.message.chat.id
    );
  }
};

const onChatMemberUpdate = (
  ctx: NarrowedContext<Context, Update.ChatMemberUpdate>
): void => {
  const member = ctx.update.chat_member;

  if (member.invite_link) {
    const invLink = member.invite_link.invite_link;
    logger.verbose(`join inviteLink ${invLink}`);
    if (invLink.includes("?start=") && invLink.length === 96) {
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

const onMyChatMemberUpdate = async (ctx: any): Promise<void> => {
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
  onChatStart,
  onChatMemberUpdate,
  onMyChatMemberUpdate,
  onUserJoined,
  onUserLeftGroup,
  onUserRemoved,
  onBlocked,
  onMessage
};
