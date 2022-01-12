import axios from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { Message, Update } from "typegram";
import Bot from "../Bot";
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
        const userHash = await getUserHash(platformUserId);
        logger.verbose(`onChatStart userHash - ${userHash}`);

        await ctx.reply(
          "Thank you for joining, I'll send the invites as soon as possible."
        );

        const res = await axios.post(
          `${config.backendUrl}/user/getAccessibleGroupIds`,
          {
            refId,
            platformUserId
          }
        );
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
            const inviteLink = await generateInvite(groupId, userHash);

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
  refId: string,
  platformUserId: number,
  groupId: number
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

const onUserJoinedGroup = async (ctx: any): Promise<void> => {
  logger.verbose("function: onUseJoinedGroup");

  ctx.message.new_chat_members.map(async (member: any) => {
    if (member.id === ctx.botInfo.id) {
      try {
        await Bot.Client.sendMessage(
          ctx.message.chat.id,
          `The ID of the group "${
            (await getGroupName(ctx.message.chat.id)) as any
          }":\n${ctx.message.chat.id}`
        );
        if (ctx.message.chat.type !== "supergroup") {
          await Bot.Client.sendMessage(
            ctx.message.chat.id,
            `This Group is currently not a Supergroup. Please convert your Group into Supergroup first. There is a tutorial GIF in the attachment.`
          );
          await Bot.Client.sendAnimation(
            ctx.message.chat.id,
            "https://i.imgur.com/obwfHdt.mp4"
          );
        }
      } catch (error) {
        logger.error(`Error while calling onUserJoinedGroup:\n${error}`);
      }
    }
  });
};

// eslint-disable-next-line no-unused-vars
const onUserLeftGroup = (ctx: any): void => {
  // if (mtprotoApi.getUser().user.id !== ctx.update.message.left_chat_member.id) {
  //   ctx.reply(`Bye, ${ctx.message.left_chat_member.first_name} 😢`);
  // }
};

const onUserRemoved = async (
  platformUserId: number,
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

const onChatMemberUpdate = (
  ctx: NarrowedContext<Context, Update.ChatMemberUpdate>
): void => {
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

const onSuperGroupChatCreation = (ctx: any): void => {
  if (
    ctx.message.chat.type === "supergroup" &&
    ctx.message.migrate_to_chat_id !== null
  ) {
    Bot.Client.sendMessage(
      ctx.message.chat.id,
      `The Group successfully converted into Supergroup. Please make sure, our Bot has administrator permissions still.`
    ).catch((err) => logger.error(err));
    Bot.Client.sendMessage(
      ctx.message.chat.id,
      `Warning! The NEW ID of the group "${
        getGroupName(ctx.message.chat.id).catch((err) =>
          logger.error(err)
        ) as any
      }":\n${ctx.message.chat.id}`
    ).catch((err) => logger.error(err));
  }
};

export {
  onChatStart,
  onChatMemberUpdate,
  onMyChatMemberUpdate,
  onUserJoined,
  onUserJoinedGroup,
  onUserLeftGroup,
  onUserRemoved,
  onBlocked,
  onMessage,
  onSuperGroupChatCreation
};
