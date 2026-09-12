import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { NotificationJobData } from './notificationQueue';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export const notificationWorker = new Worker(
  'outbound-notifications',
  async (job: Job) => {
    const { recipientPhone, bodyText, ticketId } = job.data;

    // Guard against unconfigured Meta credentials during local dev
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.log(`[NotificationWorker][STUB] Outbound msg to \({recipientPhone} for ticket\){ticketId}: "${bodyText}"`);
      return;
    }

    const endpoint = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    await axios.post(
      endpoint,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { preview_url: false, body: bodyText },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
  },
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 80, // Respect Meta Graph API tier rate limits (per second)
      duration: 1000,
    },
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[NotificationWorker] Dispatched update for ticket ${job.data.ticketId}`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotificationWorker] Failed sending to ticket ${job?.data?.ticketId}:`, err.message);
});