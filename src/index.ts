import { app as restApi } from './app'
import { app } from './appPrefix'
import { fetchMessages } from './helpers/services/schedule'
import { logger } from './logger'

const port = app.get('port')
const host = app.get('host')

process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection %O', reason))

const main = async () => {
  const server = await app.listen(port);
  logger.info(`SUB APP  prefix ${"/" + app.get('appName')}`);
  await restApi.setup(server)
  logger.info(`-----------------------------Feathers app listening on http://${host}:${port}${"/" + app.get('appName')}--------------------`);

  fetchMessages(restApi);

  await restApi.get("KafkaBatchConsumer").run();
}
main()

