import axios from "axios";
import api from "./api/api";
import Bot from "./Bot";
import config from "./config";
import { logAxiosResponse } from "./utils/utils";

export default class Main {
  static start(): void {
    // start listener
    api();

    // log all axios responses
    axios.interceptors.response.use(logAxiosResponse);

    // setup the Telegram bot
    Bot.setup(config.telegramToken);
  }
}

Main.start();
