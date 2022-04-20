import { Router } from "express";
import { controller } from "./controller";
import validators from "./validators";

const createRouter = () => {
  const router: Router = Router();

  router.post(
    "/upgrade",
    [
      validators.bodyPlatformUserId,
      validators.groupsValidator,
      validators.messageValidator
    ],
    controller.upgrade
  );

  router.post(
    "/downgrade",
    [
      validators.bodyPlatformUserId,
      validators.groupsValidator,
      validators.messageValidator
    ],
    controller.downgrade
  );

  router.post(
    "/isMember",
    [validators.bodyPlatformUserId, validators.groupsValidator],
    controller.isMember
  );

  router.get("/isIn/:groupId", validators.paramGroupId, controller.isIn);

  router.get("/:groupId", validators.paramGroupId, controller.getGroupNameById);

  router.get(
    "/user/:platformUserId",
    validators.paramPlatformUserId,
    controller.getUser
  );

  router.post(
    "/poll",
    [
      validators.bodyNumberIdValidator("id"),
      validators.bodyIdValidator("platformId"),
      validators.bodyStringValidator("question"),
      validators.bodyIdValidator("expDate"),
      validators.bodyArrayValidator("options")
    ],
    controller.createPoll
  );

  return router;
};

export default createRouter;
