import axios from "axios";
import dayjs from "dayjs";
import { Markup } from "telegraf";
import Bot from "../Bot";
import config from "../config";
import logger from "../utils/logger";
import { createPollText } from "../utils/utils";
import { leaveCommunity } from "./common";
import pollStorage from "./pollStorage";

const confirmLeaveCommunityAction = async (ctx: any): Promise<void> => {
  const data = ctx.match[0];
  const commId = data.split("_")[2];
  const commName = data.split(`leave_confirm_${commId}_`)[1];

  ctx.replyWithMarkdown(
    `You'll be kicked from every *${commName}* group. Are you sure?`,
    Markup.inlineKeyboard([
      Markup.button.callback("Yes", `leave_confirmed_${commId}`),
      Markup.button.callback("No", "no")
    ])
  );
};

const confirmedLeaveCommunityAction = async (ctx: any): Promise<void> => {
  leaveCommunity(
    ctx.update.callback_query.from.id,
    ctx.match[0].split("leave_confirmed_")[1]
  );
};

const chooseRequirementAction = async (ctx: any): Promise<void> => {
  try {
    const { message: msg, data } = ctx.update.callback_query;
    const {
      message_id,
      chat: { id: chatId }
    } = msg;
    const [requrementInfo, requrementId] = data.split(";");

    pollStorage.saveReqId(chatId, requrementId);

    await Bot.Client.editMessageText(
      chatId,
      message_id,
      undefined,
      `Your choosen token is:\n\n${requrementInfo}`
    );

    pollStorage.setUserStep(chatId, 2);

    await Bot.Client.sendMessage(
      chatId,
      "Now, please send me the question of your poll."
    );
  } catch (err) {
    logger.error(err);
  }
};

const voteAction = async (ctx: any): Promise<void> => {
  try {
    const { message: msg, data, from } = ctx.update.callback_query;
    const [optionIndex, pollId] = data.split(";");
    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);
    const chatId = msg.chat.id;
    const pollText = msg.text;

    const poll = pollResponse?.data;

    if (!poll) {
      return;
    }

    if (dayjs().isBefore(dayjs.unix(poll.expDate))) {
      await axios.post(`${config.backendUrl}/poll/vote`, {
        platform: config.platform,
        pollId,
        platformUserId: from.id,
        optionIndex
      });
    }

    const votersResponse = await axios.get(
      `${config.backendUrl}/poll/voters/${pollId}`
    );

    const newPollText = await createPollText(poll, votersResponse);

    if (pollText.trim() === newPollText.trim()) {
      return;
    }

    const voteButtonRow = poll.options.map((option, idx) => [
      {
        text: option,
        callback_data: `${idx};${poll.id};Vote`
      }
    ]);

    try {
      await Bot.Client.editMessageText(
        chatId,
        msg.message_id,
        undefined,
        newPollText,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: voteButtonRow
          }
        }
      );
    } catch (err) {
      logger.warn("Couldn't update message text");
    }
  } catch (err) {
    logger.error(err);
  }
};

export {
  confirmLeaveCommunityAction,
  confirmedLeaveCommunityAction,
  chooseRequirementAction,
  voteAction
};
