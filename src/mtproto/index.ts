// @ts-ignore
import MTProto from "@mtproto/core";
import path from "path";
// @ts-ignore
import { sleep } from "@mtproto/core/src/utils/common";
import config from "../config";
import logger from "../utils/logger";

class MTProtoApi {
  private mtproto;

  constructor() {
    this.mtproto = new MTProto({
      api_id: config.mtproto.apiId,
      api_hash: config.mtproto.apiHash,

      storageOptions: {
        path: path.resolve(__dirname, "./data/1.json")
      }
    });
  }

  async call(method: any, params: any, options = {}): Promise<any> {
    try {
      const result = await this.mtproto.call(method, params, options);

      return result;
    } catch (error) {
      logger.error(`MTProto ${method} error: ${JSON.stringify(error)}`);

      const { error_code, error_message } = error;

      if (error_code === 420) {
        const seconds = Number(error_message.split("FLOOD_WAIT_")[1]);
        const ms = seconds * 1000;

        await sleep(ms);

        return this.call(method, params, options);
      }

      if (error_code === 303) {
        const [type, dcIdAsString] = error_message.split("_MIGRATE_");

        const dcId = Number(dcIdAsString);

        if (type === "PHONE") {
          await this.mtproto.setDefaultDc(dcId);
        } else {
          Object.assign(options, { dcId });
        }

        return this.call(method, params, options);
      }

      return Promise.reject(error);
    }
  }
}

const mtprotoApi = new MTProtoApi();

export default mtprotoApi;
