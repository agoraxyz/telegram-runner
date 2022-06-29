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

type IsInResult =
  | { ok: false; message: string }
  | {
      groupIcon: string;
      groupName: string;
      ok: true;
    };

type AccessEventParams = {
  action: "ADD" | "REMOVE";
  platformUserId: string;
  platformGuildId: string;
  guildName: string;
  platformGuildData: { inviteChannel: string };
  roles: {
    roleName: string;
    platformRoleId: string;
    platformRoleData?: {
      isGuarded?: boolean;
    };
  }[];
};

type GuildEventParams = {
  action: "CREATE" | "UPDATE" | "DELETE";
  guildName: string;
  platformGuildId: string;
  platformGuildData?: { inviteChannel?: string };
};

type GuildEventResponse =
  | {
      platformGuildId: string;
      platformGuildData: { inviteChannel: string };
    }
  | { success: boolean };

type RoleEventParams = {
  action: "CREATE" | "UPDATE" | "DELETE";
  roleName: string;
  platformGuildId: string;
  platformGuildData: { inviteChannel: string };
  platformRoleId?: string;
  platformRoleData?: {
    isGuarded?: boolean;
    gatedChannels?: string[];
    grantAccessToExistingUsers: boolean;
  };
};

type RoleEventResponse =
  | {
      platformGuildData: { inviteChannel: string };
      platformRoleId: string;
    }
  | { success: boolean };

export {
  ManageGroupsParam,
  IsMemberParam,
  CommunityResult,
  LevelInfo,
  ErrorResult,
  IsInResult,
  AccessEventParams,
  GuildEventParams,
  GuildEventResponse,
  RoleEventParams,
  RoleEventResponse
};
