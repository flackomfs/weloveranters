import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

export function getFirebaseAdminApp() {
  if (!firebaseAdminConfig.projectId || !firebaseAdminConfig.clientEmail || !firebaseAdminConfig.privateKey) {
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: firebaseAdminConfig.projectId,
      clientEmail: firebaseAdminConfig.clientEmail,
      privateKey: firebaseAdminConfig.privateKey
    })
  });
}

export async function verifyIdToken(token: string) {
  const app = getFirebaseAdminApp();

  if (!app || !token) {
    throw new Error('Firebase admin is not configured for token verification.');
  }

  try {
    return await getAuth(app).verifyIdToken(token);
  } catch (error) {
    throw new Error('Invalid Firebase token');
  }
}
