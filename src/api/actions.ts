import { Markup } from "telegraf";
import { getGroupName, kickUser } from "../service/common";
import Bot from "../Bot";
import { ManageGroupsParam } from "./types";
import logger from "../utils/logger";
import { getUserPlatformId } from "../utils/utils";

const isMember = async (
  groupId: string,
  userHash: string
): Promise<Boolean> => {
  logger.verbose(
    `Called isMember, groupId=${groupId}, platformUserId=${userHash}`
  );

  try {
    const platformUserId = await getUserPlatformId(userHash);
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
  platformUserId: string,
  groupId: string,
  userHash: string
): Promise<string | undefined> => {
  logger.verbose(
    `Called generateInvite, platformUserId=${platformUserId}, ` +
      `groupId=${groupId}`
  );

  try {
    const isTelegramUser = await isMember(groupId, userHash);
    logger.verbose(`groupId=groupId, isMember=${isTelegramUser}`);

    if (!isTelegramUser) {
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
  const platformUserId = await getUserPlatformId(userHash);

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
