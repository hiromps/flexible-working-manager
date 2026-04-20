import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  // Clerk ダッシュボードで Webhook を設定した際に発行されるシークレット
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // リクエストヘッダーの取得
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // ボディの取得
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // 署名の検証
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  const eventType = evt.type

  // ユーザーが新しく作成された時の処理
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address

    // 名前の生成（名前がない場合はメールアドレスの@より前を使用）
    const fullName = [last_name, first_name].filter(Boolean).join(' ') || email?.split('@')[0] || '未設定'
    
    // 一意の社員コードを適当に生成 (実運用では要件に合わせて変更)
    const employeeCode = `EMP-${id.slice(-6).toUpperCase()}`

    // Supabase Service Role クライアントの作成 (RLSをバイパスしてINSERTするため)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Creating profile and employee for ${id}`)

    // 1. Profile の作成
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: id,
        email: email,
        role: 'employee',
      })

    if (profileError) {
      console.error('Error inserting profile:', profileError)
      return new Response('Error creating profile', { status: 500 })
    }

    console.log(`Successfully created profile for user ${id}`)
  }

  return new Response('Webhook processed successfully', { status: 200 })
}
