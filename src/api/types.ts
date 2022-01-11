// prettier-ignore
type ManageGroupsParam = {
  userHash: string;
  groupIds      : string[];
  message       : string;
};

type IsMemberParam = {
  userHash: string;
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
  errors: { msg: string; value: string[] }[];
};

class ActionError extends Error {
  ids: string[];

  constructor(message: string, ids: string[]) {
    super(message);
    this.ids = ids;
  }
}

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
  ActionError,
  CreateGroupParam,
  IsInResult
};
