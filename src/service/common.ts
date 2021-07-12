import axios from "axios";
import Bot from "../Bot";
import { CommunityResult } from "../api/types";
import config from "../config";
import logger from "../utils/logger";

const getGroupName = async (groupId: string): Promise<string> =>
  ((await Bot.Client.getChat(groupId)) as { title: string }).title;

const fetchCommunitiesOfUser = async (
  platformUserId: string
): Promise<CommunityResult[]> =>
  (
    (await axios.get(`${config.backendUrl}/communities/${platformUserId}`))
      .data as CommunityResult[]
  ).filter((community) => community.telegramIsMember);

const leaveCommunity = (platformUserId: string, communityId: string): void => {
  axios
    .post(`${config.backendUrl}/user/left`, {
      platformUserId,
      platform: config.platform,
      communityId
    })
    .then((res) => logger.debug(JSON.stringify(res.data)))
    .catch(logger.error);
};

const kickUser = (
  groupId: string,
  platformUserId: string,
  reason: string
): void => {
  Bot.Client.kickChatMember(groupId, +platformUserId)
    .then(async () => {
      const groupName = await getGroupName(groupId);
      const msg =
        `You have been kicked from the group **"${groupName}"**, ` +
        `because you ${reason}`;

      Bot.Client.sendMessage(platformUserId, msg).catch(() =>
        logger.error(
          "Couldn't send message to Telegram user " +
            `with userId "${platformUserId}"`
        )
      );
    })
    .catch(() =>
      logger.error(
        `Couldn't remove Telegram user with userId "${platformUserId}"`
      )
    );
};

export { getGroupName, fetchCommunitiesOfUser, leaveCommunity, kickUser };
