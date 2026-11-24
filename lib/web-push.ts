import 'server-only';
import type { Client } from '@libsql/client';
import * as webPush from 'web-push';
import { findUserShards, getConfiguredTursoShards } from '@/lib/turso';
import { getNotificationCategory, type NotificationType } from '@/lib/notifications';

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
  actorId: string;
  type: string;
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

export async function sendPushNotifications(_client: Client, notificationIds: string[]) {
  const ids = Array.from(new Set(notificationIds.filter(Boolean)));
  if (!ids.length) return;

  try {
    const shards = getConfiguredTursoShards();
    let vapidConfigured = false;
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batchIds = ids.slice(offset, offset + 100);
      const notificationResults = await Promise.all(shards.map((shard) => shard.client.execute({
        sql: `SELECT id, recipient_id AS recipientId, actor_id AS actorId, type
          FROM notifications WHERE id IN (${batchIds.map(() => '?').join(', ')})`,
        args: batchIds
      })));
      const notifications: PushNotificationRow[] = notificationResults.flatMap((result) =>
        result.rows.map((row) => ({
        id: String(row.id),
        recipientId: String(row.recipientId),
        actorId: String(row.actorId),
        type: String(row.type)
      })));
      if (!notifications.length) continue;

      const userIds = Array.from(new Set(notifications.flatMap((notification) => [notification.recipientId, notification.actorId])));
      const userShards = await findUserShards(userIds);
      const recipientIds = Array.from(new Set(notifications.map((notification) => notification.recipientId)));
      const recipientShards = new Map<number, { client: Client; userIds: string[] }>();
      for (const recipientId of recipientIds) {
        const shard = userShards.get(recipientId);
        if (!shard) continue;
        const group = recipientShards.get(shard.id) || { client: shard.client, userIds: [] };
        group.userIds.push(recipientId);
        recipientShards.set(shard.id, group);
      }

      const [subscriptionResults, preferenceResults] = await Promise.all([
        Promise.all(Array.from(recipientShards.values()).map(({ client, userIds: idsForShard }) => client.execute({
          sql: `SELECT user_id AS userId, endpoint, p256dh, auth
            FROM web_push_subscriptions WHERE user_id IN (${idsForShard.map(() => '?').join(', ')})`,
          args: idsForShard
        }))),
        Promise.all(Array.from(recipientShards.values()).map(({ client, userIds: idsForShard }) => client.execute({
          sql: `SELECT user_id AS userId, type, enabled FROM notification_preferences
            WHERE user_id IN (${idsForShard.map(() => '?').join(', ')})`,
          args: idsForShard
        })))
      ]);
      const subscriptionsByUser = new Map<string, StoredSubscription[]>();
      const clientByEndpoint = new Map<string, Client>();
      for (let index = 0; index < subscriptionResults.length; index += 1) {
        const client = Array.from(recipientShards.values())[index].client;
        for (const resultRow of subscriptionResults[index].rows) {
          const row: SubscriptionRow = {
            userId: String(resultRow.userId),
            endpoint: String(resultRow.endpoint),
            keys: { p256dh: String(resultRow.p256dh), auth: String(resultRow.auth) }
          };
          const subscriptions = subscriptionsByUser.get(row.userId) || [];
          subscriptions.push({ endpoint: row.endpoint, keys: row.keys });
          subscriptionsByUser.set(row.userId, subscriptions);
          clientByEndpoint.set(row.endpoint, client);
        }
      }
      const preferences = new Map<string, boolean>();
      for (const result of preferenceResults) {
        for (const row of result.rows) {
          preferences.set(`${String(row.userId)}:${String(row.type)}`, Number(row.enabled) !== 0);
        }
      }
      const actorIdsByShard = new Map<number, { client: Client; ids: string[] }>();
      for (const notification of notifications) {
        const shard = userShards.get(notification.actorId);
        if (!shard) continue;
        const group = actorIdsByShard.get(shard.id) || { client: shard.client, ids: [] };
        group.ids.push(notification.actorId);
        actorIdsByShard.set(shard.id, group);
      }
      const actorNames = new Map<string, string>();
      await Promise.all(Array.from(actorIdsByShard.values()).map(async ({ client, ids: actorIds }) => {
        const distinctIds = Array.from(new Set(actorIds));
        const result = await client.execute({
          sql: `SELECT id, display_name FROM users WHERE id IN (${distinctIds.map(() => '?').join(', ')})`,
          args: distinctIds
        });
        for (const row of result.rows) actorNames.set(String(row.id), String(row.display_name || 'Someone'));
      }));

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
        const category = getNotificationCategory(notification.type as NotificationType);
        if (preferences.get(`${notification.recipientId}:${category}`) === false) return [];
        const actorName = actorNames.get(notification.actorId) || 'Someone';
        const text = getNotificationText(notification.type, actorName);
        const payload = JSON.stringify({ ...text, url: '/notifications', tag: notification.id });
        return (subscriptionsByUser.get(notification.recipientId) || []).map(async (subscription) => {
          try {
            await webPush.sendNotification(subscription, payload);
          } catch (error) {
            const statusCode = getStatusCode(error);
            if (statusCode === 404 || statusCode === 410) {
              await clientByEndpoint.get(subscription.endpoint)?.execute({
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
