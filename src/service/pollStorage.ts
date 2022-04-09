type StoragePoll = {
  requirementId: number;
  chatId: string;
  question: string;
  options: string[];
  date: string;
};

const pollOfUser: Map<string, StoragePoll> = new Map();
const userStep: Map<string, number> = new Map();

const setUserStep = (userId: number, step: number): void => {
  userStep.set(userId.toString(), step);
};

const getUserStep = (userId: number): number => userStep.get(userId.toString());

const initPoll = (userId: number, chatId: string): void => {
  const pollOptions: string[] = [];
  pollOfUser.set(userId.toString(), {
    requirementId: 0,
    chatId,
    question: "",
    options: pollOptions,
    date: ""
  });
};

const saveReqId = (userId: number, requirementId: number): void => {
  const poll = pollOfUser.get(userId.toString());
  poll.requirementId = requirementId;
  pollOfUser.set(userId.toString(), poll);
};

const savePollQuestion = (userId: number, question: string): void => {
  const poll = pollOfUser.get(userId.toString());
  poll.question = question;
  pollOfUser.set(userId.toString(), poll);
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

const savePollExpDate = (userId: number, date: string): void => {
  const poll = pollOfUser.get(userId.toString());
  poll.date = date;
  pollOfUser.set(userId.toString(), poll);
};

const getPoll = (userId: number) => pollOfUser.get(userId.toString());

const deleteMemory = (userId: number) => {
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
