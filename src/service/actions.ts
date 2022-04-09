import axios from "axios";
import dayjs from "dayjs";
import { Markup } from "telegraf";
import Bot from "../Bot";
import config from "../config";
import logger from "../utils/logger";
import {
  createPollText,
  createVoteListText,
  logAxiosResponse,
  updatePollTexts
} from "../utils/utils";
import { leaveCommunity } from "./common";
import pollStorage from "./pollStorage";

const confirmLeaveCommunityAction = (ctx: any): void => {
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

const confirmedLeaveCommunityAction = (ctx: any): void => {
  leaveCommunity(
    ctx.update.callback_query.from.id,
    ctx.match[0].split("leave_confirmed_")[1]
  );
};

const pickRequirementAction = async (ctx: any): Promise<void> => {
  try {
    const { message: msg, data } = ctx.update.callback_query;
    /* prettier-ignore */
    const { message_id, chat: { id: chatId }} = msg;
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

const listVotersAction = async (ctx: any): Promise<void> => {
  try {
    const [chatId, pollId] = ctx.update.callback_query.data.split(";");

    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);
    logAxiosResponse(pollResponse);

    const poll = pollResponse.data;

    const responseText = await createVoteListText(chatId, poll);

    await Bot.Client.sendMessage(
      ctx.update.callback_query.from.id,
      responseText
    );
  } catch (err) {
    logger.error(err);
  }
};

const updateResultAction = async (ctx: any): Promise<void> => {
  try {
    const pollText = ctx.update.callback_query.message.text;
    const data: string[] = ctx.update.callback_query.data.split(";");
    const pollId = data[1];
    const [chatId, pollMessageId] = data[0].split(":");
    const adminId = ctx.update.callback_query.message.chat.id;
    const adminMessageId = ctx.update.callback_query.message.message_id;
    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);

    logAxiosResponse(pollResponse);
    if (pollResponse.data.length === 0) {
      return;
    }

    const poll = pollResponse.data;
    const newPollText = await createPollText(poll, chatId);

    await updatePollTexts(
      pollText,
      newPollText,
      poll,
      chatId,
      pollMessageId,
      adminId,
      adminMessageId
    );
  } catch (err) {
    logger.error(err);
  }
};

const voteAction = async (ctx: any): Promise<void> => {
  try {
    const pollText = ctx.update.callback_query.message.text;
    const data: string[] = ctx.update.callback_query.data.split(";");
    data.pop();
    const adminInfo = data.pop().split(":");
    const [adminId] = adminInfo.map((adminData) => Number(adminData));
    const adminMessageId = parseInt(adminInfo[1], 10);
    const pollId = data.pop();
    const chatId = ctx.update.callback_query.message.chat.id;
    const pollMessageId = ctx.update.callback_query.message.message_id;
    const platformUserId = ctx.update.callback_query.from.id;
    const voterOption = data.join(";");
    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);

    logAxiosResponse(pollResponse);

    if (pollResponse.data.length === 0) {
      return;
    }

    const poll = pollResponse.data;

    if (dayjs().isBefore(dayjs.unix(poll.expDate))) {
      const voteResponse = await axios.post(`${config.backendUrl}/poll/vote`, {
        pollId,
        platformUserId,
        option: voterOption
      });

      logAxiosResponse(voteResponse);
    }

    const newPollText = await createPollText(poll, chatId);

    await updatePollTexts(
      pollText,
      newPollText,
      poll,
      chatId,
      pollMessageId,
      adminId,
      adminMessageId
    );
  } catch (err) {
    logger.error(err);
  }
};

export {
  confirmLeaveCommunityAction,
  confirmedLeaveCommunityAction,
  pickRequirementAction,
  listVotersAction,
  updateResultAction,
  voteAction
};
