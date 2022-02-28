export type Poll = {
  id: number;
  question: string;
  startDate: number;
  expDate: number;
  options: string[];
  roleId: number;
};

export type UserVote = {
  tgId: string;
  balance: number;
};
