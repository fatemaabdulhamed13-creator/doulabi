/**
 * Minimal Expo Push Notification Service client.
 *
 * The mobile app (dowlaby-mobile) is an Expo-managed app with an EAS project
 * already provisioned, so Expo's push service is the natural provider here —
 * it brokers delivery to APNs (iOS) and FCM (Android) for us, with no
 * separate Apple/Google credentials to manage on our end. No SDK dependency:
 * it's a single JSON POST endpoint, so a plain `fetch` keeps this dependency-
 * free like the rest of lib/.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

/** Expo caps each request at 100 messages. */
const CHUNK_SIZE = 100

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  priority?: 'default' | 'normal' | 'high'
}

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } }

/**
 * Sends a batch of messages, chunked to Expo's 100-per-request limit.
 * Returns one ticket per input message, in the same order, so callers can
 * zip the result back up against the token/message that produced it.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const chunks: ExpoPushMessage[][] = []
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(chunk),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText)
          // Whole chunk failed at the transport level (bad request, Expo
          // outage, etc.) — report every message in it as failed rather
          // than throwing and losing the other chunks' results.
          return chunk.map<ExpoPushTicket>(() => ({
            status: 'error',
            message: `Expo push request failed (${res.status}): ${errText}`,
          }))
        }

        const json = (await res.json()) as { data?: ExpoPushTicket[] }
        return json.data ?? chunk.map<ExpoPushTicket>(() => ({
          status: 'error',
          message: 'Expo push response had no data array',
        }))
      } catch (err) {
        return chunk.map<ExpoPushTicket>(() => ({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown network error',
        }))
      }
    }),
  )

  return chunkResults.flat()
}

/**
 * Ticket-level error codes that mean the token itself is dead and should be
 * deactivated so we stop sending to it. (`MessageTooBig`/`MessageRateExceeded`
 * are about the message, not the token, so they're deliberately excluded.)
 */
export const DEAD_TOKEN_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials'])
