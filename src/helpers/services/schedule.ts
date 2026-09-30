import { Application } from '@feathersjs/feathers';
import schedule from 'node-schedule';
import { logger } from '../../logger'


export const fetchMessages = (app: Application) => {

    const job = schedule.scheduleJob('*/5 * * * * *', async () => {
        try {
            const s = app.service('retry-from-queue');
            await s.get('retry');
            logger.info(`Fetched messages at: ${new Date()}`);
            console.log('Fetched messages at:', new Date());
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    });

    return job;
}
