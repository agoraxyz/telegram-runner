import axios from "axios";
import { Platform, setApiBaseUrl } from "@guildxyz/sdk";
import api from "./api/api";
import Bot from "./Bot";
import config from "./config";
import logger from "./utils/logger";
import { logAxiosResponse } from "./utils/utils";

export default class Main {
  public static platform: Platform;

  public static async start(): Promise<void> {
    // log all axios responses
    axios.interceptors.response.use(logAxiosResponse);

    // setup sdk
    setApiBaseUrl(config.backendUrl);
    logger.info(`Backend url set to ${config.backendUrl}`);
    this.platform = new Platform(config.platform);

    // start listener
    api();

    // setup the Telegram bot
    Bot.setup(config.telegramToken);
  }
}

Main.start();
