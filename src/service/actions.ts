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

const confirmedLeaveCommunityAction = (ctx: any): Promise<void> =>
  leaveCommunity(
    ctx.update.callback_query.from.id,
    ctx.match[0].split("leave_confirmed_")[1]
  );

const chooseRequirementAction = async (ctx: any): Promise<void> => {
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
    const { data, from } = ctx.update.callback_query;
    const [chatId, pollId] = data.split(";");

    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);

    logAxiosResponse(pollResponse);

    const responseText = await createVoteListText(chatId, pollResponse.data);

    await Bot.Client.sendMessage(from.id, responseText);
  } catch (err) {
    logger.error(err);
  }
};

const updateResultAction = async (ctx: any): Promise<void> => {
  try {
    const { message: msg, data: cbData } = ctx.update.callback_query;
    const pollText = msg.text;
    const data = cbData.split(";");
    const pollId = data[1];
    const [chatId, pollMessageId] = data[0].split(":");
    const adminId = msg.chat.id;
    const adminMessageId = msg.message_id;
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
    const { message: msg, data, from } = ctx.update.callback_query;
    const pollText = msg.text;
    const [option, pollId, adminInfo] = data.split(";");
    const [adminId, adminMessageId] = adminInfo.split(":");
    const chatId = msg.chat.id;
    const pollResponse = await axios.get(`${config.backendUrl}/poll/${pollId}`);

    logAxiosResponse(pollResponse);

    if (pollResponse.data.length === 0) {
      return;
    }

    const poll = pollResponse.data;

    if (dayjs().isBefore(dayjs.unix(poll.expDate))) {
      const voteResponse = await axios.post(`${config.backendUrl}/poll/vote`, {
        platform: config.platform,
        pollId,
        platformUserId: from.id,
        optionIndex: poll.options.indexOf(option)
      });

      logAxiosResponse(voteResponse);
    }

    const newPollText = await createPollText(poll, chatId);

    await updatePollTexts(
      pollText,
      newPollText,
      poll,
      chatId,
      msg.message_id,
      parseInt(adminId, 10),
      parseInt(adminMessageId, 10)
    );
  } catch (err) {
    logger.error(err);
  }
};

export {
  confirmLeaveCommunityAction,
  confirmedLeaveCommunityAction,
  chooseRequirementAction,
  listVotersAction,
  updateResultAction,
  voteAction
};
