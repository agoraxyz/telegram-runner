/* eslint no-underscore-dangle: ["error", { "allowAfterThis": true }] */

import { Telegraf, Telegram } from "telegraf";
import * as TGEvents from "./service";
import logger from "./utils/logger";
import config from "./config";
import api from "./api/api";

export default class Main {
  private static tg: Telegram;

  static get Client(): Telegram {
    return this.tg;
  }

  static start(): void {
    // Start listener
    api();

    // initializing the chatbot with our API token
    const bot = new Telegraf(config.telegramToken);

    // telegram client instance
    this.tg = bot.telegram;

    bot.use(async (ctx, next) => {
      const start = Date.now();
      return next().then(async () => {
        const ms = Date.now() - start;
        logger.verbose(`response time ${ms}ms`);

        const update = ctx.update as any;

        // user deleted private chat with the bot
        if (update?.my_chat_member?.new_chat_member?.status === "kicked") {
          TGEvents.onBlocked(ctx);
        } else if (update?.chat_member?.invite_link) {
          const member = update.chat_member;
          const invLink = member.invite_link.invite_link;

          // TODO: tell the HUB that a new user joined the group
          await TGEvents.onUserJoined(invLink, member.from.id, member.chat.id);

          // TODO: check if the user fullfills the requirements
          await TGEvents.onUserRemoved(member.from.id, member.chat.id);

          // TODO: otherwise welcome the user
          logger.debug(invLink);
        }
      });
    });

    // listening on new chat with a Telegram user
    bot.start((ctx) => TGEvents.onChatStart(ctx));

    // user uses the help command
    bot.help((ctx) => TGEvents.helpCommand(ctx));

    // user wants to leave community
    bot.command("leave", (ctx) => TGEvents.leaveCommand(ctx));

    // a user sends a message
    bot.on("message", (ctx) => TGEvents.onMessage(ctx));

    // a user left the group
    bot.on("left_chat_member", (ctx) => TGEvents.onUserLeftGroup(ctx));

    // user has chosen a community to leave
    bot.action(/^leave_[0-9]+_[a-zA-Z0-9]+/, (ctx) =>
      TGEvents.leaveCommunityAction(ctx)
    );

    // user confirmed leaving the community
    bot.action(/^leave_[0-9]+/, (ctx) =>
      TGEvents.confirmLeaveCommunityAction(ctx)
    );

    // start the bot
    bot.launch({
      allowedUpdates: ["chat_member", "my_chat_member", "message"]
    });

    // enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));

    logger.verbose("Medousa is alive...");
  }
}

Main.start();
