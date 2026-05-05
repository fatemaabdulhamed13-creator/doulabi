'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function toggleFavoriteAction(productId: string, _?: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: existing } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId)
  } else {
    await supabase
      .from('favorites')
      .insert({ user_id: user.id, product_id: productId })
  }

  revalidatePath('/favorites')
  revalidatePath(`/product/${productId}`)
  revalidatePath('/')
}
