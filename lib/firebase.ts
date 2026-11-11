import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

export async function verifyIdToken(token: string) {
  if (!token) {
    throw new Error('No Firebase ID token provided.');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase admin is not configured for server-side token verification.');
  }

  if (!getAdminApps().length) {
    initializeAdminApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  return getAdminAuth().verifyIdToken(token);
}
