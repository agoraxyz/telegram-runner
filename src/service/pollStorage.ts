type StoragePoll = {
  requirementId: number;
  chatId: string;
  question: string;
  options: string[];
  date: string;
};

const pollOfUser: Map<string, StoragePoll> = new Map();
const userStep: Map<string, number> = new Map();

const setUserStep = (userId: string, step: number): void => {
  userStep.set(userId, step);
};

const getUserStep = (userId: string): number => userStep.get(userId);

const initPoll = (userId: string, chatId: string): void => {
  const pollOptions: string[] = [];
  pollOfUser.set(userId, {
    requirementId: 0,
    chatId,
    question: "",
    options: pollOptions,
    date: ""
  });
};

const saveReqId = (userId: string, requirementId: number): void => {
  const poll = pollOfUser.get(userId);
  poll.requirementId = requirementId;
  pollOfUser.set(userId, poll);
};

const savePollQuestion = (userId: string, question: string): void => {
  const poll = pollOfUser.get(userId);
  poll.question = question;
  pollOfUser.set(userId, poll);
};

const savePollOption = (userId: string, option: string): boolean => {
  const poll = pollOfUser.get(userId);
  if (poll.options.includes(option)) {
    return false;
  }
  poll.options.push(option);
  pollOfUser.set(userId, poll);
  return true;
};

const savePollExpDate = (userId: string, date: string): void => {
  const poll = pollOfUser.get(userId);
  poll.date = date;
  pollOfUser.set(userId, poll);
};

const getPoll = (userId: string) => pollOfUser.get(userId);

const deleteMemory = (userId: string) => {
  userStep.set(userId, 0);
  pollOfUser.delete(userId);
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
