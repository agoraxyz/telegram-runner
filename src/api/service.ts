import { createHash, createHmac } from "crypto";
import config from "../config";
import { generateInvite, kickUser } from "../service/common";
import { SuccessResult } from "../service/types";
import logger from "../utils/logger";
import { getGroupName, isMember } from "./actions";
import {
  AccessEventParams,
  GuildEventParams,
  GuildEventResponse,
  OauthData,
  RoleEventParams,
  RoleEventResponse
} from "./types";

const service = {
  access: async (params: AccessEventParams[]): Promise<SuccessResult[]> => {
    logger.verbose({ message: "access params", meta: params });

    const result = await Promise.all(
      params.map(async (item) => {
        const { action, platformUserId, platformGuildId } = item;

        try {
          if (action === "ADD") {
            return {
              success: await isMember(platformGuildId, +platformUserId),
              errorMsg: null
            };
          }
          return await kickUser(+platformGuildId, +platformUserId);
        } catch (error) {
          return {
            success: false,
            errorMsg: error.message
          };
        }
      })
    );

    logger.verbose({ message: "access result", meta: result });

    return result;
  },

  guild: async (params: GuildEventParams): Promise<GuildEventResponse> => {
    logger.verbose({ message: "guild params", meta: params });

    const { platformGuildId } = params;

    const result = {
      platformGuildId,
      platformGuildData: { inviteChannel: null }
    };

    logger.verbose({ message: "guild result", meta: result });

    return result;
  },

  role: async (params: RoleEventParams): Promise<RoleEventResponse> => {
    logger.verbose({ message: "role params", meta: params });

    const { platformRoleId } = params;

    const result = {
      platformGuildData: { inviteChannel: null },
      platformRoleId
    };

    logger.verbose({ message: "role result", meta: result });

    return result;
  },

  info: async (platformGuildId: string) => {
    logger.verbose({ message: "info params", meta: { platformGuildId } });

    const name = await getGroupName(+platformGuildId);
    const invite = await generateInvite(platformGuildId);
    const result = { name, invite };

    logger.verbose({ message: "info result", meta: result });

    return result;
  },

  resolveUser: async (params) => {
    logger.verbose({ message: "resolveUser params", meta: params });

    const hashOfToken = createHash("sha256")
      .update(config.telegramToken)
      .digest();

    const verify = (authData: OauthData) => {
      const { hash, ...rest } = authData;

      const hashRecreation = createHmac("sha256", hashOfToken)
        .update(
          Object.entries(rest)
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join("\n")
        )
        .digest("hex");

      return hash === hashRecreation;
    };

    const result = {
      platformUserId: verify(params) ? params.id : null,
      platformUserData: null
    };

    logger.verbose({ message: "resolveUser result", meta: result });

    return result;
  }
};

export { service };
