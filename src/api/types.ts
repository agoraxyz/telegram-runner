// prettier-ignore
type ManageGroupsParam = {
  platformUserId: number;
  groupIds      : string[];
  message       : string;
};

type IsMemberParam = {
  platformUserId: number;
  groupIds: string[];
};

// prettier-ignore
type CommunityResult = {
  id              : string;
  name            : string;
  url             : string;
  telegramIsMember: boolean;
};

type LevelInfo = {
  name: string;
  levels: string[];
};

type ErrorResult = {
  errors: { msg: string }[];
};

type CreateGroupParam = {
  title: string;
};

type IsInResult = {
  ok: boolean;
  message?: string;
};

export {
  ManageGroupsParam,
  IsMemberParam,
  CommunityResult,
  LevelInfo,
  ErrorResult,
  CreateGroupParam,
  IsInResult
};
