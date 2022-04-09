import { Context, NarrowedContext } from "telegraf";
import { Message, Update } from "typegram";

type Poll = {
  id: number;
  question: string;
  startDate: number;
  expDate: number;
  options: string[];
  roleId: number;
};

type UserVote = {
  tgId: string;
  balance: number;
};

type Ctx = NarrowedContext<
  Context,
  {
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }
> & { startPayload?: string };

export { Poll, UserVote, Ctx };
