export type Poll = {
  id: string;
  question: string;
  startDate: Date;
  expDate: Date;
  options: string[];
  roleId: number;
};
