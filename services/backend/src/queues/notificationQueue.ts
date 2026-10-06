import { Queue } from 'bullmq';
import { redisConfig } from './intakeQueue';

export interface NotificationJobData {
  recipientPhone: string;
  templateName?: string;
  bodyText: string;
  ticketId: string;
}

export const notificationQueue = new Queue('outbound-notifications', {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});