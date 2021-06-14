type ManageGroupsParam = {
  userId: string;
  groupIds: string[];
  message: string;
};

type InviteResult = {
  code: string;
};

type CommunityUrlResult = {
  name: string;
  url: string;
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

export {
  ManageGroupsParam,
  InviteResult,
  CommunityUrlResult,
  ErrorResult,
  ActionError
};
