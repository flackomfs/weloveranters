import 'server-only';
import type { Client } from '@libsql/client';
import * as webPush from 'web-push';

type StoredSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type PushNotificationRow = {
  id: string;
  recipientId: string;
  type: string;
  actorName: string | null;
};

type SubscriptionRow = StoredSubscription & {
  userId: string;
};

const allowedPushHosts = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com'
];

export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (!url.port || url.port === '443')
      && (
        allowedPushHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
        || url.hostname.endsWith('.notify.windows.com')
      );
  } catch {
    return false;
  }
}

export function getWebPushConfig() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
  const subject = process.env.WEB_PUSH_SUBJECT || process.env.NEXT_PUBLIC_APP_URL || 'https://weloveranters.me';
  const validSubject = /^(https:\/\/\S+|mailto:\S+)$/i.test(subject);
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && validSubject) };
}

function getStatusCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  return typeof error.statusCode === 'number' ? error.statusCode : null;
}

function getNotificationText(type: string, actorName: string) {
  switch (type) {
    case 'follow': return { title: 'New follower', body: `${actorName} followed you.` };
    case 'unfollow': return { title: 'Follower update', body: `${actorName} unfollowed you.` };
    case 'post': return { title: 'New post', body: `${actorName} shared a new rant.` };
    case 'like': return { title: 'New reaction', body: `${actorName} liked your post.` };
    case 'comment': return { title: 'New comment', body: `${actorName} commented on your post.` };
    case 'repost': return { title: 'New repost', body: `${actorName} reposted your post.` };
    case 'mention': return { title: 'You were mentioned', body: `${actorName} mentioned you.` };
    default: return { title: 'WeLoveRanters', body: `${actorName} sent you a notification.` };
  }
}

export async function sendPushNotifications(client: Client, notificationIds: string[]) {
  const ids = Array.from(new Set(notificationIds.filter(Boolean)));
  if (!ids.length) return;

  try {
    let vapidConfigured = false;
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batchIds = ids.slice(offset, offset + 100);
      const notificationsResult = await client.execute({
        sql: `SELECT n.id, n.recipient_id AS recipientId, n.type,
            actor.display_name AS actorName
          FROM notifications n
          LEFT JOIN users actor ON actor.id = n.actor_id
          WHERE n.id IN (${batchIds.map(() => '?').join(', ')})`,
        args: batchIds
      });
      const notifications: PushNotificationRow[] = notificationsResult.rows.map((row) => ({
        id: String(row.id),
        recipientId: String(row.recipientId),
        type: String(row.type),
        actorName: typeof row.actorName === 'string' ? row.actorName : null
      }));
      if (!notifications.length) continue;

      const recipientIds = Array.from(new Set(notifications.map((notification) => notification.recipientId)));
      const subscriptionsResult = await client.execute({
        sql: `SELECT user_id AS userId, endpoint, p256dh, auth
          FROM web_push_subscriptions
          WHERE user_id IN (${recipientIds.map(() => '?').join(', ')})`,
        args: recipientIds
      });
      const subscriptionsByUser = new Map<string, StoredSubscription[]>();
      for (const resultRow of subscriptionsResult.rows) {
        const row: SubscriptionRow = {
          userId: String(resultRow.userId),
          endpoint: String(resultRow.endpoint),
          keys: {
            p256dh: String(resultRow.p256dh),
            auth: String(resultRow.auth)
          }
        };
        const subscriptions = subscriptionsByUser.get(row.userId) || [];
        subscriptions.push({ endpoint: row.endpoint, keys: row.keys });
        subscriptionsByUser.set(row.userId, subscriptions);
      }

      if (!Array.from(subscriptionsByUser.values()).some((subscriptions) => subscriptions.length > 0)) continue;
      if (!vapidConfigured) {
        const config = getWebPushConfig();
        if (!config.configured) {
          console.error('Web push delivery skipped: VAPID keys are not configured.');
          return;
        }
        webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
        vapidConfigured = true;
      }

      const deliveries = notifications.flatMap((notification) => {
        const actorName = notification.actorName || 'Someone';
        const text = getNotificationText(notification.type, actorName);
        const payload = JSON.stringify({ ...text, url: '/notifications', tag: notification.id });
        return (subscriptionsByUser.get(notification.recipientId) || []).map(async (subscription) => {
          try {
            await webPush.sendNotification(subscription, payload);
          } catch (error) {
            const statusCode = getStatusCode(error);
            if (statusCode === 404 || statusCode === 410) {
              await client.execute({
                sql: 'DELETE FROM web_push_subscriptions WHERE endpoint = ?',
                args: [subscription.endpoint]
              });
              return;
            }
            throw error;
          }
        });
      });
      const results = await Promise.allSettled(deliveries);
      for (const result of results) {
        if (result.status === 'rejected') {
          const statusCode = getStatusCode(result.reason);
          console.error('Web push delivery failed:', statusCode ? `HTTP ${statusCode}` : 'Unexpected push service error.');
        }
      }
    }
  } catch (error) {
    console.error('Unable to deliver web push notifications:', error instanceof Error ? error.message : 'Unknown error');
  }
}
