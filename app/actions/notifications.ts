'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/actions/product'
import {
  sendExpoPushNotifications,
  DEAD_TOKEN_ERRORS,
  type ExpoPushMessage,
} from '@/lib/push/expo'
import { TITLE_MAX_LEN, BODY_MAX_LEN } from '@/lib/push/constants'

export type TargetPlatform = 'all' | 'ios' | 'android'

export type SendNotificationResult = {
  error?: string
  success?: boolean
  successCount?: number
  failureCount?: number
}

/** Active device tokens for a platform filter, as (id, platform, token, owner) rows. */
async function getActiveTokens(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  platform: TargetPlatform,
) {
  let query = supabase
    .from('device_tokens')
    .select('id, push_token, user_id')
    .eq('is_active', true)

  if (platform !== 'all') query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Writes one inbox row per recipient — best-effort, never throws, since a
 * failed inbox write shouldn't block the push send or (for the approval
 * path) the approval itself. Recipients are deduped by user_id: a user
 * with two devices still only gets one inbox row.
 */
async function writeInboxRows(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  userIds: (string | null)[],
  notification: { title: string; body: string; data: Record<string, unknown> },
) {
  const distinctUserIds = [...new Set(userIds.filter((id): id is string => !!id))]
  if (distinctUserIds.length === 0) return

  const { error } = await supabase.from('notifications').insert(
    distinctUserIds.map((user_id) => ({
      user_id,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    })),
  )
  if (error) console.error('[notifications] inbox insert failed:', error.message)
}

/**
 * Deactivates tokens the push service reported as dead, and tallies
 * success/failure counts. Shared by the broadcast and test-send paths.
 */
async function dispatchAndTally(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  tokens: { id: string; push_token: string }[],
  message: Omit<ExpoPushMessage, 'to'>,
) {
  const tickets = await sendExpoPushNotifications(
    tokens.map((t) => ({ ...message, to: t.push_token })),
  )

  const deadTokenIds: string[] = []
  let successCount = 0
  let failureCount = 0

  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok') {
      successCount++
    } else {
      failureCount++
      const errorCode = ticket.details?.error
      if (errorCode && DEAD_TOKEN_ERRORS.has(errorCode)) {
        deadTokenIds.push(tokens[i].id)
      }
    }
  })

  if (deadTokenIds.length > 0) {
    // Best-effort pruning — a failure here shouldn't fail the whole send,
    // the row(s) will just get retried on the next campaign.
    await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .in('id', deadTokenIds)
      .then(({ error }) => {
        if (error) console.error('[notifications] token pruning failed:', error.message)
      })
  }

  return { successCount, failureCount }
}

/**
 * Broadcasts a notification to every active device on the selected
 * platform(s) and logs the campaign. Mass-send stays synchronous inside this
 * Server Action rather than going through a queue: Expo's own endpoint does
 * the actual fan-out to APNs/FCM, so this request only has to make one POST
 * per 100 devices — fine within a serverless function's timeout for this
 * app's audience size. If the device count grows enough that a single
 * request risks timing out, move this loop into a Vercel Cron-drained
 * `notification_jobs` table instead of rewriting the send logic itself.
 */
export async function sendNotificationAction(input: {
  title: string
  body: string
  targetPlatform: TargetPlatform
  listingId?: string
  collectionSlug?: string
}): Promise<SendNotificationResult> {
  try {
    const supabase = await requireAdmin()

    const title = input.title.trim()
    const body = input.body.trim()
    const targetPlatform = input.targetPlatform
    const listingId = input.listingId?.trim() || undefined
    const collectionSlug = input.collectionSlug?.trim() || undefined

    if (!title) return { error: 'العنوان مطلوب.' }
    if (title.length > TITLE_MAX_LEN) return { error: `العنوان طويل جداً (الحد الأقصى ${TITLE_MAX_LEN} حرفاً).` }
    if (!body) return { error: 'نص الإشعار مطلوب.' }
    if (body.length > BODY_MAX_LEN) return { error: `نص الإشعار طويل جداً (الحد الأقصى ${BODY_MAX_LEN} حرفاً).` }
    if (!['all', 'ios', 'android'].includes(targetPlatform)) return { error: 'فئة مستهدفة غير صالحة.' }

    const tokens = await getActiveTokens(supabase, targetPlatform)
    if (tokens.length === 0) return { error: 'لا يوجد أي جهاز نشط ضمن الفئة المختارة.' }

    // listingId wins if somehow both are set — the compose form only ever
    // lets one link type be active at a time (see ComposeForm.tsx).
    const data = listingId
      ? { screen: 'listing', listingId }
      : collectionSlug
        ? { screen: 'collection', slug: collectionSlug }
        : { screen: 'home' }
    const { successCount, failureCount } = await dispatchAndTally(supabase, tokens, {
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    })

    await writeInboxRows(supabase, tokens.map((t) => t.user_id), { title, body, data })

    const { data: { user } } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('notification_campaigns').insert({
      title,
      body,
      data,
      target_platform: targetPlatform,
      total_recipients: tokens.length,
      success_count: successCount,
      failure_count: failureCount,
      sent_by: user?.id ?? null,
    })
    if (insertError) console.error('[notifications] history insert failed:', insertError.message)

    revalidatePath('/admin/notifications')
    return { success: true, successCount, failureCount }
  } catch (err) {
    console.error('[sendNotificationAction] unhandled error:', err)
    return { error: `حدث خطأ غير متوقع: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Notifies one seller that their listing was approved. Called directly from
 * `approveProductAction`/`approveProductWithImagesAction` right after the
 * status update succeeds — best-effort throughout: swallows its own errors
 * so neither the inbox write nor the push failing (no device registered,
 * dead token, Expo outage) ever blocks the approval itself. The inbox row
 * is written unconditionally (a seller with no registered device still
 * sees it next time they open the app); the push only goes out if they
 * have an active device. Deliberately not logged to `notification_campaigns`
 * — that table is for admin-broadcast campaigns, not per-listing sends.
 */
export async function notifySellerListingApproved(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  params: { sellerId: string; productId: string; title: string },
): Promise<void> {
  const title = 'تمت الموافقة على إعلانك'
  const data = { screen: 'listing', listingId: params.productId }

  await writeInboxRows(supabase, [params.sellerId], { title, body: params.title, data })

  try {
    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('id, push_token')
      .eq('is_active', true)
      .eq('user_id', params.sellerId)

    if (error) throw new Error(error.message)
    if (!tokens || tokens.length === 0) return

    await dispatchAndTally(supabase, tokens, {
      title,
      body: params.title,
      data,
      sound: 'default',
      priority: 'high',
    })
  } catch (err) {
    console.error('[notifySellerListingApproved] push failed:', err)
  }
}

export type SendTestNotificationResult = { error?: string; success?: boolean }

/**
 * Sends to one user's registered device(s) only. Deliberately not logged to
 * notification_campaigns — that history is for real broadcasts, not admin
 * dry-runs.
 */
export async function sendTestNotificationAction(input: {
  title: string
  body: string
  testUserId: string
}): Promise<SendTestNotificationResult> {
  try {
    const supabase = await requireAdmin()

    const title = input.title.trim()
    const body = input.body.trim()
    const testUserId = input.testUserId.trim()

    if (!title || !body) return { error: 'يرجى تعبئة العنوان والنص أولاً.' }
    if (!testUserId) return { error: 'أدخل معرّف المستخدم (User ID) لإرسال تجربة.' }

    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('id, push_token')
      .eq('is_active', true)
      .eq('user_id', testUserId)

    if (error) return { error: error.message }
    if (!tokens || tokens.length === 0) {
      return { error: 'لا يوجد جهاز مسجّل ونشط لهذا المستخدم.' }
    }

    const { successCount } = await dispatchAndTally(supabase, tokens, {
      title,
      body,
      data: { screen: 'home' },
      sound: 'default',
      priority: 'high',
    })

    if (successCount === 0) return { error: 'تعذّر إرسال الإشعار التجريبي — تحقق من الجهاز.' }
    return { success: true }
  } catch (err) {
    console.error('[sendTestNotificationAction] unhandled error:', err)
    return { error: `حدث خطأ غير متوقع: ${err instanceof Error ? err.message : String(err)}` }
  }
}
