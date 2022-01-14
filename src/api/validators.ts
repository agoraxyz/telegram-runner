import { body, param } from "express-validator";

const getPlatformUserIdValidatorForParam = (fieldName: string) =>
  param(fieldName).isString().trim().isLength({ min: 1, max: 64 });

const getPlatformUserIdValidatorForBody = (fieldName: string) =>
  body(fieldName).isString().trim().isLength({ min: 1, max: 64 });

export default {
  paramPlatformUserId: getPlatformUserIdValidatorForParam,
  bodyPlatformUserId: getPlatformUserIdValidatorForBody,
  groupsValidator: body("groupIds").isArray({ min: 1 }),
  messageValidator: body("message").isString().trim().isLength({ min: 1 }),
  titleValidator: body("title").isString().trim().isLength({ min: 1 })
};
