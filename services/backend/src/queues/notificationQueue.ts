import { Queue } from 'bullmq';

export interface NotificationJobData {
  recipientPhone: string;
  templateName?: string;
  bodyText: string;
  ticketId: string;
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const notificationQueue = new Queue('outbound-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});