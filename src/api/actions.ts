import { Markup } from "telegraf";
import { getGroupName, kickUser } from "../service/common";
import Bot from "../Bot";
import { ManageGroupsParam } from "./types";
import logger from "../utils/logger";
import { UnixTime } from "../utils/utils";

const isMember = async (
  groupId: string,
  platformUserId: number
): Promise<Boolean> => {
  logger.verbose(
    `Called isMember, groupId=${groupId}, platformUserId=${platformUserId}`
  );

  try {
    const member = await Bot.Client.getChatMember(groupId, platformUserId);
    return member !== undefined && member.status === "member";
  } catch (_) {
    return false;
  }
};

const generateInvite = async (
  platformUserId: string,
  groupId: string
): Promise<string | undefined> => {
  logger.verbose(
    `Called generateInvite, platformUserId=${platformUserId}, ` +
      `groupId=${groupId}`
  );

  try {
    const isTelegramUser = await isMember(groupId, +platformUserId);
    logger.verbose(`isMember result: ${isTelegramUser}`);

    if (!isTelegramUser) {
      await Bot.Client.unbanChatMember(groupId, +platformUserId);
      const generate = await Bot.Client.createChatInviteLink(groupId, {
        expire_date: UnixTime(new Date()) + 900,
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

  const { platformUserId } = params;

  let result: boolean = true;

  if (isUpgrade) {
    const invites: { link: string; name: string }[] = [];

    await Promise.all(
      params.groupIds.map(async (groupId) => {
        const member = await isMember(groupId, +platformUserId);

        try {
          if (!member) {
            const inviteLink = await generateInvite(
              params.platformUserId,
              groupId
            );

            if (inviteLink !== undefined) {
              invites.push({
                link: inviteLink,
                name: await getGroupName(groupId)
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
          "You have 15 minutes to join these groups before the invite links " +
            "expire:",
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
          const member = await isMember(groupId, +platformUserId);

          if (member) {
            kickUser(
              groupId,
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

export { manageGroups, generateInvite, getGroupName, isMember };
