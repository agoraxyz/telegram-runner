import crypto from "crypto";
import config from "../config";
import { kickUser } from "../service/common";
import { SuccessResult } from "../service/types";
import logger from "../utils/logger";
import { getGroupName, isMember } from "./actions";

const service = {
  access: async (payload): Promise<SuccessResult[]> => {
    logger.verbose({ message: "access params", meta: payload });

    const result = await Promise.all(
      payload.map(async (item) => {
        const { action, platformUserId, platformGuildId } = item;

        return action === "REMOVE"
          ? kickUser(platformGuildId, platformUserId)
          : {
              success: await isMember(platformGuildId, platformUserId),
              errorMsg: null
            };
      })
    );

    logger.verbose({ message: "access result", meta: result });

    return result;
  },

  guild: async (payload) => {
    logger.verbose({ message: "guild params", meta: payload });

    const { platformGuildId, platformGuildData } = payload;

    const result = { platformGuildId, platformGuildData };

    logger.verbose({ message: "guild result", meta: result });

    return result;
  },

  role: async (payload) => {
    logger.verbose({ message: "role params", meta: payload });

    const result = true;

    logger.verbose({ message: "role result", meta: result });

    return result;
  },

  info: async (platformGuildId: string) => {
    logger.verbose({ message: "info params", meta: platformGuildId });

    const name = await getGroupName(+platformGuildId);
    const result = { name, invite: null };

    logger.verbose({ message: "info result", meta: result });

    return result;
  },

  resolveUser: async (payload) => {
    logger.verbose({ message: "resolveUser params", meta: payload });

    const { auth_date, first_name, hash, id, username } = payload.user;

    const data_check_string = `auth_date=${auth_date}\nfirst_name=${first_name}\nid=${id}\nusername=${username}`;
    const secret_key = crypto
      .createHash("sha256")
      .update(config.telegramToken)
      .digest("hex");
    const hashed = crypto
      .createHmac("sha256", secret_key)
      .update(data_check_string)
      .digest("hex");

    logger.debug(hash);
    logger.debug(hashed);

    const result = {
      platformUserId: hashed === hash ? id : null,
      platformUserData: null
    };

    logger.verbose({ message: "resolveUser result", meta: result });

    return result;
  }
};

export { service };
