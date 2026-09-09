/**
 * Shared between the notifications Server Action and the client compose
 * form. Kept out of app/actions/notifications.ts because a "use server"
 * file may only export async functions — plain constants have to live
 * somewhere else.
 */
export const TITLE_MAX_LEN = 65
export const BODY_MAX_LEN = 178
