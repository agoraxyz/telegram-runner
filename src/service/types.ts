import { Context, NarrowedContext } from "telegraf";
import { Message, Update } from "telegraf/types";

type NewPoll = {
  requirementId: number;
  platformId: string;
  question: string;
  options: string[];
  expDate: string;
};

type Poll = {
  id: number;
  question: string;
  startDate: number;
  expDate: number;
  options: string[];
};

type Ctx = NarrowedContext<
  Context,
  {
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }
> & { startPayload?: string };

export { NewPoll, Poll, Ctx };
