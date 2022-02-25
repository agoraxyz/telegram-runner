export type Poll = {
  id: number;
  question: string;
  startDate: Date;
  expDate: Date;
  options: string[];
  roleId: number;
};

export type UserVote = {
  tgId: string;
  balance: number;
};
