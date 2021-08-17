import axios from "axios";
import { Markup } from "telegraf";
import { generateInvite } from "../api/actions";
import { fetchCommunitiesOfUser, getGroupName, leaveCommunity } from "./common";
import config from "../config";
import logger from "../utils/logger";
import { getUserHash, logAxiosResponse } from "../utils/utils";

const onMessage = async (ctx: any): Promise<void> => {
  if (ctx.message.chat.id > 0) {
    try {
      await ctx.reply("I'm sorry, but I couldn't interpret your request.");
      await ctx.replyWithMarkdown(
        "You can find more information on the " +
          "[Agora](https://app.agora.space/) website."
      );
    } catch (err) {
      logger.error(err);
    }
  }
};

const onChatStart = async (ctx: any): Promise<void> => {
  const { message } = ctx;

  if (message.chat.id > 0) {
    if (new RegExp(/^\/start [0-9]+_[0-9]+$/).test(message.text)) {
      const [refId, communityId] = message.text.split("/start ")[1].split("_");
      const platformUserId = `${message.from.id}`;

      try {
        const userHash = await getUserHash(platformUserId);
        logger.verbose(`onChatStart userHash - ${userHash}`);

        await ctx.reply(
          "Thank you for joining, I'll send the invites as soon as possible."
        );

        const res = await axios.post(
          `${config.backendUrl}/user/getAccessibleGroupIds`,
          {
            refId,
            platform: config.platform,
            platformUserId: userHash,
            communityId
          }
        );

        logAxiosResponse(res);

        const invites: { link: string; name: string }[] = [];

        await Promise.all(
          res.data.map(async (groupId: string) => {
            const inviteLink = await generateInvite(
              platformUserId,
              groupId,
              userHash
            );

            if (inviteLink !== undefined) {
              invites.push({
                link: inviteLink,
                name: await getGroupName(groupId)
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
            "You are already a member of the groups of this community " +
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
  refId: string,
  platformUserId: string,
  groupId: string
): Promise<void> => {
  try {
    const userHash = await getUserHash(platformUserId);
    logger.verbose(`onUserJoined userHash - ${userHash}`);

    const res = await axios.post(`${config.backendUrl}/user/joinedPlatform`, {
      refId,
      platform: config.platform,
      platformUserId: userHash,
      groupId
    });

    logAxiosResponse(res);

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const onUserLeftGroup = (ctx: any): void => {
  ctx.reply(`Bye, ${ctx.message.left_chat_member.first_name} 😢`);
};

const onUserRemoved = async (
  platformUserId: string,
  groupId: string
): Promise<void> => {
  try {
    const userHash = await getUserHash(platformUserId);
    logger.verbose(`onUserRemoved userHash - ${userHash}`);

    const res = await axios.post(
      `${config.backendUrl}/user/removeFromPlatform`,
      {
        platform: config.platform,
        platformUserId: userHash,
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

const onChatMemberUpdate = (ctx: any): void => {
  const member = ctx.update.chat_member;

  if (member.invite_link) {
    const invLink = member.invite_link.invite_link;

    logger.verbose(
      `function: onChatMemberUpdate, user: ${member.from.id}, ` +
        `chat: ${member.chat.id}, invite: ${invLink}`
    );

    onUserJoined(invLink, member.from.id, member.chat.id);
  }
};

const onMyChatMemberUpdate = (ctx: any): void => {
  if (ctx.update.my_chat_member.new_chat_member?.status === "kicked") {
    onBlocked(ctx);
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
