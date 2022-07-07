import { Platform, setApiBaseUrl, setProjectName } from "@guildxyz/sdk";
import api from "./api/api";
import Bot from "./Bot";
import config from "./config";
import logger from "./utils/logger";

export default class Main {
  public static platform: Platform;

  public static async start(): Promise<void> {
    // setup sdk
    setApiBaseUrl(config.backendUrl);
    setProjectName("TELEGRAM connector");
    logger.info(`Backend url set to ${config.backendUrl}`);
    this.platform = new Platform(config.platform);

    // start listener
    api();

    // setup the Telegram bot
    Bot.setup(config.telegramToken);
  }
}

Main.start();
