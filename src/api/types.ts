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

type IsInResult =
  | { ok: false; message: string }
  | {
      groupIcon: string;
      groupName: string;
      ok: true;
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
