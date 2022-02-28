import express from "express";
import config from "../config";
import logger from "../utils/logger";
import router from "./router";

export default () => {
  const api = express();
  api.disable("x-powered-by");

  api.use(express.json());
  api.use(config.api.prefix, router());

  const server = api.listen(config.api.port, () =>
    logger.info(`API listening on ${config.api.port}`)
  );

  process.once("SIGINT", () => server.close());
  process.once("SIGTERM", () => server.close());

  return api;
};
