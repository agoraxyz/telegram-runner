type Poll = {
  quiestion: string;
  options: string[];
  date: string;
};

const polls: Map<string, Poll> = new Map();
const pollOfUser: Map<string, string> = new Map();
const userStep: Map<string, number> = new Map();

const setUserStep = (userId: string, step: number): void => {
  userStep.set(userId, step);
};

const getUserStep = (userId: string): number => userStep.get(userId);

const initPoll = (userId: string, pollId: string): void => {
  pollOfUser.set(userId, pollId);
};

const savePollQuestion = (userId: string, question: string): void => {
  const pollOptions: string[] = [];
  const pollId = pollOfUser.get(userId);
  polls.set(pollId, { quiestion: question, options: pollOptions, date: "" });
};

const savePollOption = (userId: string, option: string): boolean => {
  const pollId = pollOfUser.get(userId);
  const poll = polls.get(pollId);
  if (poll.options.includes(option)) {
    return false;
  } 
    poll.options.push(option);
    polls.set(pollId, poll);
    return true;
  
};

const savePollExpDate = (userId: string, date: string): void => {
  const pollId = pollOfUser.get(userId);
  const poll = polls.get(pollId);
  poll.date = date;
  polls.set(pollId, poll);
};

const getPollId = (userId: string) => pollOfUser.get(userId);

const getPoll = (pollId: string) => polls.get(pollId);

const deleteMemory = (userId: string) => {
  const pollId = pollOfUser.get(userId);
  userStep.set(userId, 0);
  polls.delete(pollId);
  pollOfUser.delete(userId);
};

export default {
  setUserStep,
  getUserStep,
  initPoll,
  savePollQuestion,
  savePollOption,
  savePollExpDate,
  getPollId,
  getPoll,
  deleteMemory
};
