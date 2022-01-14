import axios from "axios";
import { CommunityResult } from "../api/types";
import Bot from "../Bot";
import config from "../config";
import logger from "../utils/logger";
import { logAxiosResponse } from "../utils/utils";

const getGroupName = async (groupId: number): Promise<string> =>
  ((await Bot.Client.getChat(groupId)) as { title: string }).title;

const fetchCommunitiesOfUser = async (
  platformUserId: number
): Promise<CommunityResult[]> => {
  logger.verbose(
    `Called fetchCommunitiesOfUser, platformUserId=${platformUserId}`
  );

  const res = await axios.get(
    `${config.backendUrl}/communities/${platformUserId}`
  );

  logAxiosResponse(res);

  return (res.data as CommunityResult[]).filter(
    (community) => community.telegramIsMember
  );
};

const leaveCommunity = async (
  platformUserId: number,
  communityId: string
): Promise<void> => {
  logger.verbose(
    `Called leaveCommunity, platformUserId=${platformUserId}, communityId=${communityId}`
  );

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

    logAxiosResponse(res);

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const kickUser = async (
  groupId: number,
  platformUserId: number,
  reason: string
): Promise<void> => {
  logger.verbose(
    `Called kickUser, groupId=${groupId}, platformUserId=${platformUserId}, ` +
      `reason=${reason}`
  );

  try {
    await Bot.Client.kickChatMember(groupId, +platformUserId);

    const groupName = await getGroupName(groupId);

    await Bot.Client.sendMessage(
      platformUserId,
      "You have been kicked from the group " +
        `${groupName}, because you ${reason}.`
    );
  } catch (err) {
    logger.error(
      "An error occured while trying to remove a Telegram user with userId " +
        `"${platformUserId}", because:\n${err}`
    );
  }
};

const sendMessageForSupergroup = async (groupId: number) => {
  const groupName = await getGroupName(groupId);
  await Bot.Client.sendMessage(
    groupId,
    `This is the group ID of "${groupName}":\n \`${groupId}\` . Paste it to the Guild creation interface!`,
    { parse_mode: "Markdown" }
  );
  await Bot.Client.sendPhoto(groupId, `${config.assets.groupIdImage}`);
};

const sendNotASuperGroup = async (groupId: number) => {
  await Bot.Client.sendMessage(
    groupId,
    `This Group is currently not a Supergroup. Please convert your Group into Supergroup first. There is a tutorial GIF in the attachment.`
  );
  await Bot.Client.sendAnimation(groupId, `${config.assets.supergroupVideo}`);
};

const sendNotAnAdministrator = async (groupId: number) => {
  await Bot.Client.sendMessage(
    groupId,
    `The Guildxyz_bot hasn't got the right permissions to manage this group. Please make sure, our Bot has administrator permissions.`
  );
  await Bot.Client.sendAnimation(groupId, `${config.assets.adminVideo}`);
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
