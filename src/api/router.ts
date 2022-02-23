import { Router } from "express";
import { param } from "express-validator";
import { controller } from "./controller";
import validators from "./validators";

const createRouter = () => {
  const router: Router = Router();

  router.post(
    "/upgrade",
    [
      validators.bodyPlatformUserId("platformUserId"),
      validators.groupsValidator,
      validators.messageValidator
    ],
    controller.upgrade
  );

  router.post(
    "/downgrade",
    [
      validators.bodyPlatformUserId("platformUserId"),
      validators.groupsValidator,
      validators.messageValidator
    ],
    controller.downgrade
  );

  router.post(
    "/isMember",
    [
      validators.bodyPlatformUserId("platformUserId"),
      validators.groupsValidator
    ],
    controller.isMember
  );

  router.post("/group", [validators.titleValidator], controller.createGroup);

  router.get(
    "/isIn/:groupId",
    param("groupId").trim().isLength({ min: 1 }),
    controller.isIn
  );

  router.get(
    "/:groupId",
    param("groupId").trim().isLength({ min: 1 }),
    controller.getGroupNameById
  );

  router.get(
    "/user/:platformUserId",
    param("platformUserId").trim().isLength({ min: 1 }),
    controller.getUser
  );

  return router;
};

export default createRouter;
