import { body, param } from "express-validator";

const getHashValidatorForParam = (fieldName: string) =>
  param(fieldName).isString().trim().isLength({ min: 44, max: 64 });

const getHashValidatorForBody = (fieldName: string) =>
  body(fieldName).isString().trim().isLength({ min: 44, max: 64 });

export default {
  paramUserHash: getHashValidatorForParam,
  bodyUserHash: getHashValidatorForBody,
  groupsValidator: body("groupIds").isArray({ min: 1 }),
  messageValidator: body("message").isString().trim().isLength({ min: 1 })
};
