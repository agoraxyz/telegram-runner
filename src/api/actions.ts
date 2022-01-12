import { Markup } from "telegraf";
import { getGroupName, kickUser } from "../service/common";
import Bot from "../Bot";
import { IsInResult, ManageGroupsParam } from "./types";
import logger from "../utils/logger";
import { getUserTelegramId } from "../utils/utils";

const isMember = async (
  groupId: string,
  userHash: string
): Promise<boolean> => {
  logger.verbose(
    `Called isMember, groupId=${groupId}, platformUserId=${userHash}`
  );

  try {
    const platformUserId = await getUserTelegramId(userHash);
    if (!platformUserId)
      throw new Error(
        `PlatformUserId doesn't exists for ${userHash} userHash.`
      );

    const member = await Bot.Client.getChatMember(groupId, +platformUserId);
    return member !== undefined && member.status === "member";
  } catch (_) {
    return false;
  }
};

const generateInvite = async (
  groupId: string,
  userHash: string
): Promise<string | undefined> => {
  try {
    const isTelegramUser = await isMember(groupId, userHash);
    logger.verbose(`groupId=groupId, isMember=${isTelegramUser}`);
    const platformUserId = await getUserTelegramId(userHash);
    logger.verbose(
      `Called generateInvite, platformUserId=${platformUserId}, ` +
        `groupId=${groupId}`
    );

    if (!isTelegramUser && platformUserId) {
      await Bot.Client.unbanChatMember(groupId, +platformUserId);
      const generate = await Bot.Client.createChatInviteLink(groupId, {
        member_limit: 1
      });
      return generate.invite_link;
    }
    return undefined;
  } catch (err) {
    logger.error(err);
    return undefined;
  }
};

const manageGroups = async (
  params: ManageGroupsParam,
  isUpgrade: boolean
): Promise<boolean> => {
  logger.verbose(
    `Called manageGroups, params=${params}, isUpgrade=${isUpgrade}`
  );

  const { userHash } = params;
  const platformUserId = await getUserTelegramId(userHash);

  let result: boolean = true;

  if (!platformUserId)
    throw new Error(`PlatformUserId doesn't exists for ${userHash} userHash.`);

  if (isUpgrade) {
    const invites: { link: string; name: string }[] = [];

    await Promise.all(
      params.groupIds.map(async (groupId) => {
        const member = await isMember(groupId, userHash);

        try {
          if (!member) {
            const inviteLink = await generateInvite(groupId, userHash);

            if (inviteLink !== undefined) {
              invites.push({
                link: inviteLink,
                name: await getGroupName(+groupId)
              });
            }
          } else {
            result = false;
          }
        } catch (err) {
          logger.error(err);
          result = false;
        }
      })
    );

    if (invites.length) {
      try {
        await Bot.Client.sendMessage(
          platformUserId,
          `You have unlocked ${invites.length} new groups:`,
          Markup.inlineKeyboard(
            invites.map((inv) => [Markup.button.url(inv.name, inv.link)])
          )
        );
      } catch (err) {
        logger.error(err);
        result = false;
      }
    }
  } else {
    try {
      await Promise.all(
        params.groupIds.map(async (groupId) => {
          const member = await isMember(groupId, userHash);

          if (member) {
            kickUser(
              +groupId,
              platformUserId,
              "have not fullfilled the requirements"
            );
          } else {
            result = false;
          }
        })
      );
    } catch (err) {
      logger.error(err);
      result = false;
    }
  }

  return result;
};

const isIn = async (groupId: number): Promise<IsInResult> => {
  try {
    const chat = await Bot.Client.getChat(groupId);
    if (chat.type !== "supergroup") {
      return {
        ok: false,
        message:
          "This Group is not a SuperGroup! Please convert into a Supergroup first!"
      };
    }
    const membership = await Bot.Client.getChatMember(
      groupId,
      (
        await Bot.Client.getMe()
      ).id
    );
    if (membership.status !== "administrator") {
      return {
        ok: false,
        message: "It seems like our Bot hasn't got the right permissions."
      };
    }
  } catch (err) {
    return {
      ok: false,
      message:
        "You have to add @Guildxyz_bot to your Telegram group to continue!"
    };
  }

  return { ok: true };
};

export { manageGroups, generateInvite, getGroupName, isMember, isIn };
