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
    const [requrementInfo, requrementId] =
      ctx.update.callback_query.data.split(";");

    pollStorage.saveReqId(
      ctx.update.callback_query.message.chat.id,
      requrementId
    );

    await Bot.Client.editMessageText(
      ctx.update.callback_query.from.id,
      ctx.update.callback_query.message.message_id,
      undefined,
      `Your choosen token is:\n\n${requrementInfo}`
    ).catch(() => undefined);

    pollStorage.setUserStep(ctx.update.callback_query.message.chat.id, 2);

    await Bot.Client.sendMessage(
      ctx.update.callback_query.message.chat.id,
      "Now, send me the question of your poll."
    );
  } catch (err) {
    logger.error(err);
  }
};

const listVotersAction = async (ctx: any): Promise<void> => {
  try {
    const [chatId, pollId] = ctx.update.callback_query.data.split(";");

    // for testing
    logger.verbose(`ListVoters ${pollId}`);

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
    // for testing
    logger.verbose(`UpdateResult ${pollId}`);
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
    const [adminId] = adminInfo;
    const adminMessageId = parseInt(adminInfo[1], 10);
    const pollId = data.pop();
    const chatId = ctx.update.callback_query.message.chat.id;
    const pollMessageId = ctx.update.callback_query.message.message_id;
    const platformUserId = ctx.update.callback_query.from.id;

    // for testing
    logger.verbose(`Vote ${pollId}`);
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

const createGroup = async (title: string) => {
  logger.verbose(`createGroup ${title}`);
  // TODO mtproto implementation
  // const { username } = await Bot.Client.getMe();
  // const userResult = await mtprotoApi.call("contacts.resolveUsername", {
  //   username
  // });
  // logger.verbose(`userResult ${JSON.stringify(userResult)}`);
  // const user_id = {
  //   _: "inputUser",
  //   user_id: userResult.users[0].id,
  //   access_hash: userResult.users[0].access_hash
  // };

  // logger.verbose(`userResult ${user_id}`);

  // const supergroupResult = await mtprotoApi.call("channels.createChannel", {
  //   megagroup: true,
  //   title
  // });

  // logger.verbose(`supergroupResult ${JSON.stringify(supergroupResult)}`);

  // const channel = {
  //   _: "inputChannel",
  //   channel_id: supergroupResult.chats[0].id,
  //   access_hash: supergroupResult.chats[0].access_hash
  // };

  // logger.verbose(`channel ${JSON.stringify(channel)}`);

  // await mtprotoApi.call("channels.inviteToChannel", {
  //   channel,
  //   users: [user_id]
  // });

  // await mtprotoApi.call("channels.editAdmin", {
  //   channel,
  //   user_id,
  //   admin_rights: {
  //     _: "chatAdminRights",
  //     change_info: true,
  //     post_messages: true,
  //     edit_messages: true,
  //     delete_messages: true,
  //     ban_users: true,
  //     invite_users: true,
  //     pin_messages: true,
  //     add_admins: true
  //   },
  //   rank: "Medusa"
  // });

  // await mtprotoApi.call("channels.leaveChannel", { channel });

  // return `-100${channel.channel_id}`;
  return -1;
};

export {
  confirmLeaveCommunityAction,
  confirmedLeaveCommunityAction,
  pickRequirementAction,
  listVotersAction,
  updateResultAction,
  voteAction,
  createGroup
};
