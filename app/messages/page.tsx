"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import BottomNav from "@/components/bottomNavbar"
import TopNav from "@/components/TopNav"
import { MessageCircle, Send, Search, MoreVertical } from "lucide-react"
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

type Message = {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
  sender_profile?: {
    full_name?: string
    avatar_url?: string
  }
}

type Conversation = {
  user_id: string
  user_profile: {
    full_name?: string
    avatar_url?: string
    email: string
  }
  last_message: Message
  unread_count: number
}

function MessagesPageContent() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const searchParams = useSearchParams()
  const supabase = useMemo(() => {
    if (!isClient) return null
    try {
      return createClient()
    } catch (err) {
      setError('Supabase not configured')
      return null
    }
  }, [isClient])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!supabase) return
    fetchConversations()
  }, [supabase])

  useEffect(() => {
    if (selectedConversation && supabase) {
      fetchMessages(selectedConversation)
    }
  }, [selectedConversation, supabase])

  // Handle user parameter from URL
  useEffect(() => {
    const userParam = searchParams.get('user')
    if (userParam) {
      // Check if we already have a conversation with this user
      const existingConversation = conversations.find(conv => conv.user_id === userParam)
      if (existingConversation) {
        setSelectedConversation(userParam)
        setSelectedUserProfile(null) // Clear any previously fetched profile
      } else {
        // Start a new conversation with this user
        setSelectedConversation(userParam)
        // Fetch the user profile for the new conversation
        fetchUserProfile(userParam)
      }
    }
  }, [searchParams, conversations])

  async function fetchUserProfile(userId: string) {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', userId)
        .single()

      if (error) throw error
      setSelectedUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  async function fetchConversations() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // This is a simplified version - in a real app you'd need more complex queries
      // to get conversations with last messages and unread counts
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!sender_id(full_name, avatar_url, email),
          receiver_profile:profiles!receiver_id(full_name, avatar_url, email)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by conversation partner
      const conversationMap = new Map<string, Conversation>()

      data?.forEach((msg: any) => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
        const partnerProfile = msg.sender_id === user.id ? msg.receiver_profile : msg.sender_profile

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user_id: partnerId,
            user_profile: partnerProfile,
            last_message: msg,
            unread_count: msg.sender_id !== user.id && !msg.read ? 1 : 0
          })
        } else {
          const conv = conversationMap.get(partnerId)!
          if (msg.created_at > conv.last_message.created_at) {
            conv.last_message = msg
          }
          if (msg.sender_id !== user.id && !msg.read) {
            conv.unread_count++
          }
        }
      })

      setConversations(Array.from(conversationMap.values()))
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMessages(userId: string) {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!sender_id(full_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || !supabase) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          sender_id: user.id,
          receiver_id: selectedConversation
        })

      if (error) throw error

      setNewMessage("")
      fetchMessages(selectedConversation)
      fetchConversations()
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />
      <main className="pb-20 pt-16 h-[calc(100vh-5rem)]">
        <div className="h-full max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-gray-900 border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-violet-400 flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Messages
              </h1>
              <button className="text-gray-400 hover:text-violet-400 transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-400 text-sm"
              />
            </div>
          </div>

          <div className="flex h-[calc(100%-5rem)] overflow-hidden">
            {/* Conversations List */}
            <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-col border-r border-gray-800 bg-gray-900`}>
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
                    <p className="text-gray-400 mt-2">Loading conversations...</p>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 px-4">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">No conversations yet</p>
                    <p className="text-sm">Start connecting with people to begin messaging!</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {conversations.map((conv) => (
                    <div
                      key={conv.user_id}
                      onClick={() => setSelectedConversation(conv.user_id)}
                      className={`p-4 cursor-pointer hover:bg-gray-800 transition-colors border-b border-gray-800/50 ${
                        selectedConversation === conv.user_id ? 'bg-violet-400/10 border-l-4 border-l-violet-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-violet-400 rounded-full flex items-center justify-center">
                            {conv.user_profile.avatar_url ? (
                              <img src={conv.user_profile.avatar_url} alt={conv.user_profile.full_name || conv.user_profile.email} className="w-12 h-12 rounded-full" />
                            ) : (
                              <span className="text-black font-semibold text-lg">
                                {(conv.user_profile.full_name || conv.user_profile.email).charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {/* Online indicator */}
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-gray-900 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-white truncate">{conv.user_profile.full_name || 'Anonymous'}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {new Date(conv.last_message.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 truncate mt-1">{conv.last_message.content}</p>
                        </div>
                        {conv.unread_count > 0 && (
                          <div className="bg-violet-400 text-black text-xs font-semibold px-2 py-1 rounded-full min-w-[20px] text-center ml-2">
                            {conv.unread_count > 99 ? '99+' : conv.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Area */}
            {selectedConversation ? (
              <div className="flex-1 flex flex-col bg-gray-900">
                {/* Chat Header */}
                <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="lg:hidden text-gray-400 hover:text-white mr-2 p-1"
                    >
                      ←
                    </button>
                    <div className="w-10 h-10 bg-violet-400 rounded-full flex items-center justify-center">
                      {(conversations.find(c => c.user_id === selectedConversation)?.user_profile.avatar_url || selectedUserProfile?.avatar_url) ? (
                        <img
                          src={conversations.find(c => c.user_id === selectedConversation)?.user_profile.avatar_url || selectedUserProfile?.avatar_url}
                          alt={conversations.find(c => c.user_id === selectedConversation)?.user_profile.full_name || selectedUserProfile?.full_name || 'User'}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <span className="text-black font-semibold">
                          {((conversations.find(c => c.user_id === selectedConversation)?.user_profile.full_name || conversations.find(c => c.user_id === selectedConversation)?.user_profile.email) || (selectedUserProfile?.full_name || selectedUserProfile?.email) || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {conversations.find(c => c.user_id === selectedConversation)?.user_profile.full_name || selectedUserProfile?.full_name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-green-400">Online</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-violet-400 transition-colors p-1">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-semibold mb-2">No messages yet</p>
                        <p className="text-sm">Send the first message to start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_id === selectedConversation ? 'justify-start' : 'justify-end'} mb-4`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          msg.sender_id === selectedConversation
                            ? 'bg-gray-700 text-white rounded-bl-sm'
                            : 'bg-violet-400 text-black rounded-br-sm'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className={`text-xs mt-2 ${
                            msg.sender_id === selectedConversation ? 'text-gray-400' : 'text-black/70'
                          }`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="bg-gray-800 border-t border-gray-700 p-4">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Type a message..."
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 resize-none"
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-violet-400 text-black p-3 rounded-2xl hover:bg-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-900">
                <div className="text-center text-gray-400">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                  <p>Choose a conversation from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  )
}