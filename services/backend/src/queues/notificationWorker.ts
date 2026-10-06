import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConfig } from './intakeQueue';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

/**
 * Citizen Notification Worker:
 * - Employs dedicated Redis connection
 * - Concurrency capped at 5 to prevent Graph API rate limits
 * - Formats civic incident dispatch receipts and updates
 */
export const notificationWorker = new Worker(
  'outbound-notifications',
  async (job: Job) => {
    const { recipientPhone, bodyText, ticketId, clusterId, status } = job.data;

    if (!recipientPhone || recipientPhone === 'anonymous') {
      return { status: 'skipped', reason: 'Anonymous or missing recipient' };
    }

    const messageBody =
      bodyText ||
      `[Chhaya Civic Alert] Your report has been verified and triaged.\nTicket: \({ticketId}\nCluster ID:\){clusterId || 'Pending'}\nStatus: ${status || 'RECEIVED'}\nField teams have been assigned.`;

    if (!WHATSAPP_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      console.log(
        `[NotificationWorker] [MOCK_DISPATCH] To: \({recipientPhone} | Ticket:\){ticketId} | Status: ${status || 'DISPATCHED'}`
      );
      return { status: 'mock_sent', recipientPhone, ticketId, message: messageBody };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageBody,
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`[NotificationWorker] Dispatched WhatsApp update for ticket \({ticketId} to\){recipientPhone}`);
    return { status: 'delivered', messageId: response.data?.messages?.[0]?.id };
  },
  {
    connection: redisConfig as any,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000, // Maximum 20 outbound dispatches per second
    },
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[NotificationWorker] Notification job ${job.id} completed successfully.`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed permanently:`, err.message);
});