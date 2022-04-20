import { NewPoll } from "./types";

const pollOfUser: Map<string, NewPoll> = new Map();
const userStep: Map<string, number> = new Map();

const setUserStep = (userId: number, step: number): void => {
  userStep.set(userId.toString(), step);
};

const getUserStep = (userId: number): number => userStep.get(userId.toString());

const initPoll = (userId: number, platformId: string): void => {
  const pollOptions: string[] = [];
  pollOfUser.set(userId.toString(), {
    requirementId: 0,
    platformId,
    question: "",
    options: pollOptions,
    expDate: ""
  });
};

const saveReqId = (userId: number, requirementId: number): void => {
  pollOfUser.set(userId.toString(), {
    ...pollOfUser.get(userId.toString()),
    requirementId
  });
};

const savePollQuestion = (userId: number | string, question: string): void => {
  pollOfUser.set(userId.toString(), {
    ...pollOfUser.get(userId.toString()),
    question
  });
};

const savePollOption = (userId: number, option: string): boolean => {
  const poll = pollOfUser.get(userId.toString());

  if (poll.options.includes(option)) {
    return false;
  }

  poll.options.push(option);
  pollOfUser.set(userId.toString(), poll);

  return true;
};

const savePollExpDate = (userId: number, expDate: string): void => {
  pollOfUser.set(userId.toString(), {
    ...pollOfUser.get(userId.toString()),
    expDate
  });
};

const getPoll = (userId: number): NewPoll => pollOfUser.get(userId.toString());

const deleteMemory = (userId: number): void => {
  userStep.set(userId.toString(), 0);
  pollOfUser.delete(userId.toString());
};

export default {
  initPoll,
  setUserStep,
  getUserStep,
  saveReqId,
  savePollQuestion,
  savePollOption,
  savePollExpDate,
  getPoll,
  deleteMemory
};
