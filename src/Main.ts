import cluster from "cluster";
import os from "os";
import app from "./api/app";
import Bot from "./Bot";
import config from "./config";
import logger from "./utils/logger";

export default class Main {
  static start() {
    Bot.setup(config.telegramToken);
    Bot.Client.getMe()
      .then((b) => {
        config.telegramBotId = b.id;
      })
      .catch((err) => logger.verbose(err.message));
  }
}

if (config.nodeEnv === "production") {
  const totalCPUs = os.cpus().length - 1;
  if (cluster.isMaster) {
    logger.info(`${totalCPUs} CPUs will be used.`);
    logger.info(`Master ${process.pid} is running`);

    for (let i = 0; i < totalCPUs; i += 1) {
      cluster.fork();
    }

    cluster.on("exit", (worker) => {
      logger.info(`worker ${worker.process.pid} died`);
      cluster.fork();
    });
    Main.start();
  } else {
    logger.info(`Worker ${process.pid} started`);

    app.listen(config.api.port, () => {
      logger.info(
        `Worker ${process.pid} is listening on http://localhost:${config.api.port}`
      );
    });
  }
} else {
  app.listen(config.api.port, () => {
    logger.info(`App is listening on http://localhost:${config.api.port}`);
  });
  Main.start();
}
