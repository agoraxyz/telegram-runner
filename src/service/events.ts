import axios, { AxiosResponse } from "axios";
import { Context, Markup, NarrowedContext } from "telegraf";
import { Message, Update } from "typegram";
import dayjs from "dayjs";
import Bot from "../Bot";
import { generateInvite } from "../api/actions";
import {
  sendNotASuperGroup,
  fetchCommunitiesOfUser,
  getGroupName,
  leaveCommunity,
  sendMessageForSupergroup,
  sendNotAnAdministrator,
  kickUser
} from "./common";
import config from "../config";
import logger from "../utils/logger";
import { logAxiosResponse, updatePollText } from "../utils/utils";
import pollStorage from "./pollStorage";
import { Poll, UserVote } from "./types";

const onMessage = async (ctx: any): Promise<void> => {
  if (
    ctx.update.message.reply_to_message === undefined &&
    ctx.update.message.chat.type === "private"
  ) {
    try {
      await ctx.reply("I'm sorry, but I couldn't interpret your request.");
      await ctx.replyWithMarkdown(
        "You can find more information on the " +
          "[Agora](https://agora.xyz/) website."
      );
    } catch (err) {
      logger.error(err);
    }
  }
  if (
    ctx.update.message.chat.type === "private" &&
    ctx.update.message.reply_to_message.from.username === config.botUsername
  ) {
    try {
      const step = pollStorage.getUserStep(ctx.update.message.from.id);
      const promptMessage = ctx.update.message.reply_to_message.text;
      const replyMessage = ctx.update.message.text.trim();
      if (promptMessage.includes("question")) {
        if (step === 1) {
          if (
            replyMessage.includes("/done") ||
            replyMessage.includes("/cancel") ||
            replyMessage.includes("/reset")
          ) {
            return;
          }
          pollStorage.savePollQuestion(
            ctx.update.message.from.id,
            replyMessage
          );
          pollStorage.setUserStep(ctx.update.message.from.id, 2);
          await Bot.Client.sendMessage(
            ctx.update.message.from.id,
            "Now send me the duration of your poll in DD:HH:MM format. " +
              'For example if you want your poll to be active for 1.5 hours, you should send "0:1:30".',
            {
              reply_markup: { force_reply: true }
            }
          );
        }
      } else if (promptMessage.includes("DD:HH:MM")) {
        if (step === 2) {
          if (
            replyMessage.includes("/done") ||
            replyMessage.includes("/cancel") ||
            replyMessage.includes("/reset")
          ) {
            return;
          }
          const regex =
            /^([1-9][0-9]*|[0-9]):([0-1][0-9]|[0-9]|[2][0-4]):([0-5][0-9]|[0-9])$/;
          const found = replyMessage.match(regex);
          if (!found) {
            await Bot.Client.sendMessage(
              ctx.update.message.from.id,
              "The message you sent me is not in the DD:HH:MM format. " +
                "Please verify the contents of your message and send again.",
              {
                reply_markup: { force_reply: true }
              }
            );
            return;
          }
          const date = found[0];
          pollStorage.savePollExpDate(ctx.update.message.from.id, date);
          pollStorage.setUserStep(ctx.update.message.from.id, 3);
          await Bot.Client.sendMessage(
            ctx.update.message.from.id,
            "Now send me the first option of your poll.",
            {
              reply_markup: { force_reply: true }
            }
          );
        }
      } else if (promptMessage.includes("option")) {
        if (step >= 3) {
          if (
            replyMessage.includes("/done") ||
            replyMessage.includes("/cancel") ||
            replyMessage.includes("/reset")
          ) {
            return;
          }
          const optionSaved = pollStorage.savePollOption(
            ctx.update.message.from.id,
            replyMessage
          );
          if (!optionSaved) {
            await Bot.Client.sendMessage(
              ctx.update.message.from.id,
              "This option is invalid please send me another.",
              {
                reply_markup: { force_reply: true }
              }
            );
            return;
          }
          pollStorage.setUserStep(ctx.update.message.from.id, step + 1);
          if (step === 3) {
            await Bot.Client.sendMessage(
              ctx.update.message.from.id,
              "Send me the second option of your poll.",
              {
                reply_markup: { force_reply: true }
              }
            );
          } else {
            await Bot.Client.sendMessage(
              ctx.update.message.from.id,
              "You can send me another option or use /done to start and publish your poll.",
              {
                reply_markup: { force_reply: true }
              }
            );
          }
        }
      }
    } catch (err) {
      logger.error(err);
    }
  }
};

const onChatStart = async (
  ctx: NarrowedContext<
    Context,
    {
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }
  >
): Promise<void> => {
  const { message } = ctx;

  if (message.chat.id > 0) {
    if (new RegExp(/^\/start [a-z0-9]{64}$/).test(message.text)) {
      const refId = message.text.split("/start ")[1];
      const platformUserId = message.from.id;

      try {
        await ctx.reply(
          "Thank you for joining, I'll send the invites as soon as possible."
        );

        let res: AxiosResponse;
        try {
          res = await axios.post(
            `${config.backendUrl}/user/getAccessibleGroupIds`,
            {
              refId,
              platformUserId
            }
          );
        } catch (error) {
          if (error?.response?.data?.errors?.[0]?.msg === "deleted") {
            ctx.reply(
              "This invite link has expired. Please, start the joining process through the guild page again."
            );
            return;
          }
          ctx.reply(`Something went wrong. (${new Date().toUTCString()})`);
          return;
        }
        logAxiosResponse(res);

        if (res.data.length === 0) {
          ctx.reply(
            "There aren't any groups of this guild that you have access to."
          );
          return;
        }

        const invites: { link: string; name: string }[] = [];

        await Promise.all(
          res.data.map(async (groupId: string) => {
            const inviteLink = await generateInvite(groupId, platformUserId);

            if (inviteLink !== undefined) {
              invites.push({
                link: inviteLink,
                name: await getGroupName(+groupId)
              });
            }
          })
        );

        logger.verbose(`inviteLink: ${invites}`);

        if (invites.length) {
          ctx.replyWithMarkdown(
            "Use the following invite links to join the groups you unlocked:",
            Markup.inlineKeyboard(
              invites.map((inv) => [Markup.button.url(inv.name, inv.link)])
            )
          );
        } else {
          ctx.reply(
            "You are already a member of the groups of this guild " +
              "so you will not receive any invite links."
          );
        }
      } catch (err) {
        logger.error(err);
      }
    } else onMessage(ctx);
  }
};

const onUserJoined = async (
  platformUserId: number,
  groupId: number
): Promise<void> => {
  try {
    const res = await axios.post(`${config.backendUrl}/user/joinedPlatform`, {
      platform: config.platform,
      platformUserId,
      groupId
    });

    logAxiosResponse(res);

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const onUserRemoved = async (
  platformUserId: number,
  groupId: string
): Promise<void> => {
  try {
    const res = await axios.post(
      `${config.backendUrl}/user/removeFromPlatform`,
      {
        platform: config.platform,
        platformUserId,
        groupId
      }
    );

    logAxiosResponse(res);

    logger.debug(JSON.stringify(res.data));
  } catch (err) {
    logger.error(err);
  }
};

const onBlocked = async (ctx: any): Promise<void> => {
  const platformUserId = ctx.update.my_chat_member.from.id;

  logger.verbose(`User "${platformUserId}" has blocked the bot.`);

  try {
    const communities = await fetchCommunitiesOfUser(platformUserId);

    communities.forEach((community) =>
      leaveCommunity(platformUserId, community.id)
    );
  } catch (err) {
    logger.error(err);
  }
};

const onUserLeftGroup = async (ctx: any): Promise<void> => {
  if (ctx.update.message.left_chat_member.id) {
    await onUserRemoved(
      ctx.update.message.left_chat_member.id,
      ctx.update.message.chat.id
    );
  }
};

const onChatMemberUpdate = async (
  ctx: NarrowedContext<Context, Update.ChatMemberUpdate>
) => {
  const member = ctx.update.chat_member;

  if (member.invite_link) {
    const invLink = member.invite_link.invite_link;
    logger.verbose(`join inviteLink ${invLink}`);
    const bot = await Bot.Client.getMe();
    if (member.invite_link.creator.id === bot.id) {
      logger.verbose(
        `function: onChatMemberUpdate, user: ${member.from.id}, ` +
          `chat: ${member.chat.id}, invite: ${invLink}`
      );

      onUserJoined(member.from.id, member.chat.id);
    } else {
      kickUser(
        member.chat.id,
        member.from.id,
        "haven't joined through Guild interface!"
      );
    }
  }
};

const onMyChatMemberUpdate = async (ctx: any): Promise<void> => {
  try {
    if (ctx.update.my_chat_member.new_chat_member?.status === "kicked") {
      onBlocked(ctx);
    }
    if (
      ctx.update.my_chat_member.new_chat_member?.status === "member" ||
      ctx.update.my_chat_member.old_chat_member?.status === "member"
    ) {
      const groupId = ctx.update.my_chat_member.chat.id;
      if (ctx.update.my_chat_member.chat.type !== "supergroup")
        await sendNotASuperGroup(groupId);
      else if (
        ctx.update.my_chat_member.new_chat_member?.status === "administrator"
      ) {
        await Bot.Client.sendMessage(
          groupId,
          `The Guild Bot has administrator privileges from now! We are ready to roll!`
        );
        await sendMessageForSupergroup(groupId);
      } else await sendNotAnAdministrator(groupId);
    }
  } catch (error) {
    logger.error(`Error while calling onUserJoinedGroup:\n${error}`);
  }
};

const onCallbackQuery = async (ctx: any): Promise<void> => {
  try {
    const data: string[] = ctx.update.callback_query.data.split(";");
    const pollText = ctx.update.callback_query.message.text;
    const { reply_markup } = ctx.update.callback_query.message;
    const platformUserId = ctx.update.callback_query.from.id;
    let newPollText: string;
    let poll: Poll;

    if (data.pop() === "ListVoters") {
      const [pollId] = data;
      let responseText: string = "These users voted for the given options:";
      const pollResponse = await axios.get(
        `${config.backendUrl}/poll/voters/${pollId}`
      );
      logAxiosResponse(pollResponse);

      const votersResponse = await axios.get(
        `${config.backendUrl}/poll/${pollId}`
      );
      logAxiosResponse(votersResponse);

      if (pollResponse.data.length === 0) {
        return;
      }
      poll = pollResponse.data;

      if (votersResponse.data.length === 0) {
        return;
      }
      const votesByOption: {
        [k: string]: UserVote[];
      } = votersResponse.data;

      poll.options.forEach((option) => {
        responseText = responseText.concat(`\n${option}:`);
        const votes = votesByOption[option];
        votes.forEach((vote) => {
          Bot.Client.getChatMember(
            ctx.update.callback_query.message.chat.id,
            parseInt(vote.tgId, 10)
          ).then((ChatMember) => {
            const username = ChatMember.user.first_name;
            responseText = responseText.concat(
              ` (${username}=>${vote.balance})`
            );
          });
        });
      });

      await Bot.Client.sendMessage(
        ctx.update.callback_query.message.chat.id,
        responseText
      );
      return;
    }

    if (data.pop() === "UpdateResult") {
      const [pollId] = data;
      const pollResponse = await axios.get(
        `${config.backendUrl}/poll/voters/${pollId}`
      );

      logAxiosResponse(pollResponse);
      if (pollResponse.data.length === 0) {
        return;
      }

      poll = pollResponse.data;
      newPollText = await updatePollText(pollText, poll);
    } else {
      const pollId: string = data.pop();
      const voterOption = data.join(";");
      const pollResponse = await axios.get(
        `${config.backendUrl}/poll/${pollId}`
      );

      logAxiosResponse(pollResponse);
      if (pollResponse.data.length === 0) {
        return;
      }

      poll = pollResponse.data;

      if (dayjs().isBefore(dayjs(poll.expDate))) {
        const voteResponse = await axios.post(
          `${config.backendUrl}/poll/vote`,
          {
            pollId,
            platformUserId,
            option: voterOption
          }
        );
        logAxiosResponse(voteResponse);
      }
      newPollText = await updatePollText(pollText, poll);
    }

    if (newPollText === pollText) {
      return;
    }

    if (dayjs().isAfter(dayjs(poll.expDate))) {
      // Delete buttons
      Bot.Client.editMessageText(
        ctx.update.callback_query.message.chat.id,
        ctx.update.callback_query.message.message_id,
        undefined,
        newPollText
      );
      return;
    }

    Bot.Client.editMessageText(
      ctx.update.callback_query.message.chat.id,
      ctx.update.callback_query.message.message_id,
      undefined,
      newPollText,
      { reply_markup }
    );
  } catch (err) {
    logger.error(err);
  }
};

export {
  onChatStart,
  onChatMemberUpdate,
  onMyChatMemberUpdate,
  onUserJoined,
  onUserLeftGroup,
  onUserRemoved,
  onBlocked,
  onMessage,
  onCallbackQuery
};
