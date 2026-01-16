import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', user.id)
      .eq('read', false)

    if (error) throw error

    return NextResponse.json({ count: data?.length || 0 })
  } catch (error) {
    console.error('Error fetching unread messages:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}