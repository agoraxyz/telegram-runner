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
  logger.verbose({ message: "isMember", meta: { groupId, platformUserId } });

  try {
    if (!platformUserId) {
      throw new Error(`PlatformUserId doesn't exists for ${platformUserId}.`);
    }

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
    logger.verbose({
      message: "generateInvite",
      meta: { groupId, platformUserId }
    });

    if (!isTelegramUser && platformUserId) {
      await Bot.Client.unbanChatMember(groupId, +platformUserId);

      const { invite_link } = await Bot.Client.createChatInviteLink(groupId, {
        member_limit: 1
      });

      return invite_link;
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
  logger.verbose({ message: "manageGroups", meta: { params, isUpgrade } });

  const { platformUserId } = params;

  let result: boolean = true;

  if (!platformUserId) {
    throw new Error(`PlatformUserId doesn't exists for ${platformUserId}.`);
  }

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

    if (!["supergroup", "channel"].includes(chat.type)) {
      return {
        ok: false,
        message:
          "This is not a Supergroup!\n" +
          "Please convert this group into a Supergroup first!"
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
        "You have to add @Guildxyz_bot to your Telegram group/channel to continue!"
    };
  }

  return { ok: true };
};

const getUser = async (platformUserId: number) => {
  const chat = await Bot.Client.getChat(platformUserId);

  if (chat?.photo?.small_file_id) {
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
  }

  return {
    username: (chat as any).username
  };
};

export { manageGroups, generateInvite, getGroupName, isMember, isIn, getUser };
