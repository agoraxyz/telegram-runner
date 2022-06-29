import { Context, NarrowedContext } from "telegraf";
import { Message, Update } from "telegraf/types";

type SuccessResult = { success: boolean; errorMsg: string };

type NewPoll = {
  requirementId: number;
  platformId: string;
  question: string;
  description: string;
  options: string[];
  expDate: string;
};

type Poll = {
  id: number;
  requirementId: number;
  platformId: string;
  question: string;
  description: string;
  options: string[];
  startDate: number;
  expDate: number;
};

type Ctx = NarrowedContext<
  Context,
  {
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }
> & { startPayload?: string };

export { SuccessResult, NewPoll, Poll, Ctx };
