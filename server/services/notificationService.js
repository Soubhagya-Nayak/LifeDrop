/**
 * Firebase Cloud Messaging (FCM) notification service for LifeDrop.
 *
 * Set the following env vars to enable real push notifications:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (include the full PEM key with \n escaped as \\n)
 *
 * If the vars are absent the service falls back to in-app DB notifications only
 * so the rest of the system keeps working without a Firebase project.
 */

let admin = null;

const initFirebase = () => {
    if (admin) return admin; // already initialised

    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        console.warn('[FCM] Firebase env vars not set — push notifications disabled.');
        return null;
    }

    try {
        admin = require('firebase-admin');
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: FIREBASE_PROJECT_ID,
                    clientEmail: FIREBASE_CLIENT_EMAIL,
                    // .env stores \n literally — convert back to real newlines
                    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        console.log('[FCM] Firebase Admin initialised for project:', FIREBASE_PROJECT_ID);
        return admin;
    } catch (err) {
        console.error('[FCM] Firebase Admin init failed:', err.message);
        return null;
    }
};

/**
 * Send a push notification to a single FCM device token.
 *
 * @param {string} fcmToken  - The recipient device's FCM registration token
 * @param {string} title     - Notification title
 * @param {string} body      - Notification body text
 * @param {object} [data]    - Optional key-value data payload
 * @returns {Promise<boolean>} true if sent, false otherwise
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
    const firebaseAdmin = initFirebase();
    if (!firebaseAdmin || !fcmToken) return false;

    try {
        const message = {
            token: fcmToken,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'lifedrop_alerts' },
            },
            apns: {
                payload: { aps: { sound: 'default', badge: 1 } },
            },
        };

        const response = await firebaseAdmin.messaging().send(message);
        console.log(`[FCM] Sent to ${fcmToken.slice(0, 12)}… — messageId: ${response}`);
        return true;
    } catch (err) {
        console.error('[FCM] Send failed:', err.message);
        return false;
    }
};

/**
 * Send push notifications to multiple FCM tokens (multicast).
 *
 * @param {string[]} fcmTokens - Array of FCM registration tokens
 * @param {string}   title     - Notification title
 * @param {string}   body      - Notification body text
 * @param {object}   [data]    - Optional key-value data payload
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
const sendMulticastNotification = async (fcmTokens, title, body, data = {}) => {
    const firebaseAdmin = initFirebase();
    const tokens = (fcmTokens || []).filter(Boolean);
    if (!firebaseAdmin || tokens.length === 0) {
        return { successCount: 0, failureCount: tokens.length };
    }

    try {
        const message = {
            tokens,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'lifedrop_alerts' },
            },
            apns: {
                payload: { aps: { sound: 'default', badge: 1 } },
            },
        };

        const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
        console.log(`[FCM] Multicast → success: ${response.successCount}, failure: ${response.failureCount}`);
        return { successCount: response.successCount, failureCount: response.failureCount };
    } catch (err) {
        console.error('[FCM] Multicast failed:', err.message);
        return { successCount: 0, failureCount: tokens.length };
    }
};

module.exports = { sendPushNotification, sendMulticastNotification };
