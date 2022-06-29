import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { getGroupName, getUser, isIn, isMember, manageGroups } from "./actions";
import { IsMemberParam, ManageGroupsParam } from "./types";
import { getErrorResult, sendPollMessage } from "../utils/utils";
import logger from "../utils/logger";
import { service } from "./service";

const controller = {
  access: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await service.access(req.body);
      res.status(200).json(result);
    } catch (err) {
      logger.verbose(err);
      res.status(400).json(getErrorResult(err));
    }
  },

  guild: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await service.guild(req.body);
      res.status(200).json(result);
    } catch (err) {
      logger.verbose(err);
      res.status(400).json(getErrorResult(err));
    }
  },

  role: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await service.role(req.body);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  info: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await service.info(req.params.platformGuildId);
      res.status(200).json(result);
    } catch (err) {
      logger.verbose(err);
      res.status(400).json(getErrorResult(err));
    }
  },

  resolveUser: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await service.resolveUser(req.body);
      res.status(200).json(result);
    } catch (err) {
      logger.verbose(err);
      res.status(400).json(getErrorResult(err));
    }
  },

  upgrade: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const params: ManageGroupsParam = req.body;

    try {
      const result = await manageGroups(params, true);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  downgrade: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const params: ManageGroupsParam = req.body;

    try {
      const result = await manageGroups(params, false);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  isMember: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const params: IsMemberParam = req.body;
      let isTelegramMember = false;

      await Promise.all(
        params.groupIds.map(async (groupId) => {
          const inGroup = await isMember(groupId, params.platformUserId);

          if (inGroup) {
            isTelegramMember = true;
          }
        })
      );

      res.status(200).json(isTelegramMember);
    } catch (err) {
      logger.error(err);
    }
  },

  isIn: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { groupId } = req.params;

    try {
      const result = await isIn(+groupId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  getGroupNameById: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { groupId } = req.params;

    try {
      const result = await getGroupName(+groupId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  getUser: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { platformUserId } = req.params;
      const result = await getUser(+platformUserId);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  },

  createPoll: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const msgId = await sendPollMessage(req.body.platformId, req.body);

      res.status(200).json(msgId);
    } catch (err) {
      res.status(400).json(getErrorResult(err));
    }
  }
};

export { controller };
