import { Markup } from "telegraf";
import axios from "axios";
import { getGroupName, kickUser } from "../service/common";
import Bot from "../Bot";
import { IsInResult, ManageGroupsParam } from "./types";
import logger from "../utils/logger";
import config from "../config";

const isMember = async (
  groupId: string,
  platformUserId: number
): Promise<boolean> => {
  logger.verbose(
    `Called isMember, groupId=${groupId}, platformUserId=${platformUserId}`
  );

  try {
    if (!platformUserId)
      throw new Error(`PlatformUserId doesn't exists for ${platformUserId}.`);

    const member = await Bot.Client.getChatMember(groupId, +platformUserId);
    return member !== undefined && member.status === "member";
  } catch (_) {
    return false;
  }
};

const generateInvite = async (
  groupId: string,
  platformUserId: number
): Promise<string | undefined> => {
  try {
    const isTelegramUser = await isMember(groupId, platformUserId);
    logger.verbose(`groupId=groupId, isMember=${isTelegramUser}`);
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

  const { platformUserId } = params;

  let result: boolean = true;

  if (!platformUserId)
    throw new Error(`PlatformUserId doesn't exists for ${platformUserId}.`);

  if (isUpgrade) {
    const invites: { link: string; name: string }[] = [];

    await Promise.all(
      params.groupIds.map(async (groupId) => {
        const member = await isMember(groupId, platformUserId);

        try {
          if (!member) {
            const inviteLink = await generateInvite(groupId, platformUserId);

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
          const member = await isMember(groupId, platformUserId);

          if (member) {
            kickUser(
              +groupId,
              platformUserId,
              "have not fullfilled the requirements or left the guild through our website"
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

const getUser = async (platformUserId: number) => {
  const chat = await Bot.Client.getChat(platformUserId);
  const fileInfo = await axios.get(
    `https://api.telegram.org/bot${config.telegramToken}/getFile?file_id=${chat.photo.small_file_id}`
  );

  if (!fileInfo.data.ok) {
    throw Error("cannot fetch file info");
  }

  const blob = await axios.get(
    `https://api.telegram.org/file/bot${config.telegramToken}/${fileInfo.data.result.file_path}`,
    { responseType: "arraybuffer" }
  );

  return {
    username: (chat as any).username,
    avatar: `data:image/jpeg;base64,${blob.data.toString("base64")}`
  };
};

export { manageGroups, generateInvite, getGroupName, isMember, isIn, getUser };
