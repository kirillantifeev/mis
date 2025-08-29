import cron from 'node-cron';
import {NotificationService} from './notificationService.js';

const service = new NotificationService();

cron.schedule('0 * * * * *', async () => {

    try {
        await service.getNewTasksForCalls()
    } catch (err) {
        console.log('error', err)
    }
});

cron.schedule('20 * * * * *', async () => {

    try {
        await service.createCallTasksInRobotMia()
    } catch (err) {
        console.log('error', err)
    }
});

cron.schedule('40 * * * * *', async () => {

    try {
        await service.getResultsCallsApi()
    } catch (err) {
        console.log('error', err)
    }
});


console.log('Cron service started');