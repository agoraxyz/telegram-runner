import axios from "axios";
import { isMember } from "../api/actions";
import { CommunityResult } from "../api/types";
import Bot from "../Bot";
import config from "../config";
import logger from "../utils/logger";
import { SuccessResult } from "./types";

const getGroupName = async (groupId: number): Promise<string> => {
  const group = (await Bot.Client.getChat(groupId)) as { title: string };

  return group.title;
};

const fetchCommunitiesOfUser = async (
  platformUserId: number
): Promise<CommunityResult[]> => {
  logger.verbose({
    message: "fetchCommunitiesOfUser",
    meta: { platformUserId }
  });

  const res = await axios.get(
    `${config.backendUrl}/communities/${platformUserId}`
  );

  return (res.data as CommunityResult[]).filter(
    (community) => community.telegramIsMember
  );
};

const leaveCommunity = async (
  platformUserId: number,
  communityId: string
): Promise<void> => {
  logger.verbose({
    message: "leaveCommunity",
    meta: { platformUserId, communityId }
  });

  try {
    const res = await axios.post(
      `${config.backendUrl}/user/removeFromPlatform`,
      {
        platformUserId,
        platform: config.platform,
        communityId,
        triggerKick: true
      }
    );

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const kickUser = async (
  groupId: number,
  userId: number,
  reason?: string
): Promise<SuccessResult> => {
  logger.verbose({
    message: "kickUser",
    meta: { groupId, userId, reason }
  });

  try {
    await Bot.Client.banChatMember(groupId, +userId);

    const groupName = await getGroupName(groupId);

    try {
      await Bot.Client.sendMessage(
        userId,
        "You have been kicked from the group " +
          `${groupName}${reason ? `, because you ${reason}` : ""}.`
      );

      return {
        success: await isMember(groupId.toString(), userId),
        errorMsg: null
      };
    } catch (_) {
      const errorMsg = `The bot can't initiate conversation with user "${userId}"`;

      logger.warn(errorMsg);

      return { success: await isMember(groupId.toString(), userId), errorMsg };
    }
  } catch (err) {
    const errorMsg = err.response?.description;

    logger.error(errorMsg);

    return { success: false, errorMsg };
  }
};

const sendMessageForSupergroup = async (groupId: number) => {
  const groupName = await getGroupName(groupId);

  await Bot.Client.sendMessage(
    groupId,
    `This is the group ID of "${groupName}": \`${groupId}\` .\n` +
      "Paste it to the Guild creation interface!",
    { parse_mode: "Markdown" }
  );
  await Bot.Client.sendPhoto(groupId, config.assets.groupIdImage);
  await Bot.Client.sendMessage(
    groupId,
    "It is critically important to *set Group type to 'Private Group'* to create a functioning Guild",
    { parse_mode: "Markdown" }
  );
};

const sendNotASuperGroup = async (groupId: number) => {
  await Bot.Client.sendMessage(
    groupId,
    "This Group is currently not a Supergroup.\n" +
      "Please make sure to enable *all of the admin rights* for the bot.",
    { parse_mode: "Markdown" }
  );
  await Bot.Client.sendAnimation(groupId, config.assets.adminVideo);
};

const sendNotAnAdministrator = async (groupId: number) => {
  await Bot.Client.sendMessage(
    groupId,
    "Please make sure to enable *all of the admin rights* for the bot.",
    { parse_mode: "Markdown" }
  );
  await Bot.Client.sendAnimation(groupId, config.assets.adminVideo);
};

export {
  getGroupName,
  fetchCommunitiesOfUser,
  leaveCommunity,
  kickUser,
  sendNotASuperGroup,
  sendMessageForSupergroup,
  sendNotAnAdministrator
};
