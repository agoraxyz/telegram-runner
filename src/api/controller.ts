import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { getGroupName, isIn, isMember, manageGroups } from "./actions";
import { CreateGroupParam, IsMemberParam, ManageGroupsParam } from "./types";
import { getErrorResult } from "../utils/utils";
import logger from "../utils/logger";
import { createGroup } from "../service/actions";

const controller = {
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
      const errorMsg = getErrorResult(err);
      res.status(400).json(errorMsg);
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
      const errorMsg = getErrorResult(err);
      res.status(400).json(errorMsg);
    }
  },

  isMember: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }
    try {
      const params: IsMemberParam = req.body;
      let isTelegramMember = false;
      await Promise.all(
        params.groupIds.map(async (groupId) => {
          const inGroup = await isMember(groupId, params.userHash);
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

  createGroup: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }

    const params: CreateGroupParam = req.body;

    try {
      const result = await createGroup(params.title);
      res.status(200).json(result);
    } catch (err) {
      const errorMsg = getErrorResult(err);
      res.status(400).json(errorMsg);
    }
  },

  isIn: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;

    try {
      const result = await isIn(+groupId);
      res.status(200).json(result);
    } catch (err) {
      const errorMsg = getErrorResult(err);
      res.status(400).json(errorMsg);
    }
  },

  getGroupNameById: async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.params;

    try {
      const result = await getGroupName(+groupId);
      res.status(200).json(result);
    } catch (err) {
      const errorMsg = getErrorResult(err);
      res.status(400).json(errorMsg);
    }
  }
};

export { controller };
