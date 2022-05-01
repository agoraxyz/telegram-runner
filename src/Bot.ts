import { Telegraf, Telegram } from "telegraf";
import * as TGActions from "./service/actions";
import * as TGCommands from "./service/commands";
import * as TGEvents from "./service/events";
import logger from "./utils/logger";

export default class Bot {
  private static tg: Telegram;

  static get Client(): Telegram {
    return this.tg;
  }

  static setup(token: string): void {
    const bot = new Telegraf(token);

    this.tg = bot.telegram;

    // registering middleware to log the duration of updates
    bot.use(async (_, next) => {
      const start = Date.now();

      await next();

      logger.verbose(`response time ${Date.now() - start}ms`);
    });

    // built-in commands
    bot.start(TGCommands.startCommand);
    bot.help(TGCommands.helpCommand);

    // other commands
    bot.command("leave", TGCommands.leaveCommand);
    bot.command("list", TGCommands.listCommunitiesCommand);
    bot.command("ping", TGCommands.pingCommand);
    bot.command("status", TGCommands.statusUpdateCommand);
    bot.command("groupid", TGCommands.groupIdCommand);
    bot.command("add", TGCommands.addCommand);
    bot.command("poll", TGCommands.pollCommand);
    bot.command("enough", TGCommands.enoughCommand);
    bot.command("done", TGCommands.doneCommand);
    bot.command("reset", TGCommands.resetCommand);
    bot.command("cancel", TGCommands.cancelCommand);

    // event listeners
    bot.on("text", TGEvents.onMessage);
    bot.on("channel_post", TGEvents.onChannelPost);
    bot.on("left_chat_member", TGEvents.onUserLeftGroup);
    bot.on("chat_member", TGEvents.onChatMemberUpdate);
    bot.on("my_chat_member", TGEvents.onMyChatMemberUpdate);

    // action listeners
    bot.action(
      /^leave_confirm_[0-9]+_[a-zA-Z0-9 ,.:"'`]+$/,
      TGActions.confirmLeaveCommunityAction
    );
    bot.action(
      /^leave_confirmed_[0-9]+$/,
      TGActions.confirmedLeaveCommunityAction
    );
    bot.action(/;ChooseRequirement$/, TGActions.chooseRequirementAction);
    bot.action(/;Vote$/, TGActions.voteAction);

    // starting the bot
    bot.launch({
      allowedUpdates: [
        "chat_member",
        "my_chat_member",
        "message",
        "channel_post",
        "chosen_inline_result",
        "callback_query"
      ]
    });

    bot.catch((err) => {
      logger.error(err);
    });

    // enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));

    logger.verbose("Guild bot is alive...");
  }
}
