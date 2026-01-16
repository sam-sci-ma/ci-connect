"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import BottomNav from "@/components/bottomNavbar"
import TopNav from "@/components/TopNav"
import { Users, UserPlus, Search, MessageCircle } from "lucide-react"
import AlertModal, { useAlertModal } from "@/components/ui/alert-modal"

export const dynamic = 'force-dynamic'

type User = {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

export default function NetworkingPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isClient, setIsClient] = useState(false)
  const [activeTab, setActiveTab] = useState<'discover' | 'requests' | 'connections'>('discover')
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const alertModal = useAlertModal()
  const router = useRouter()
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
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getCurrentUser()
    fetchUsers()
    fetchPendingRequests()
    fetchConnections()
  }, [supabase])

  async function fetchUsers() {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .neq('id', (await supabase.auth.getUser()).data.user?.id)

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPendingRequests() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // First try without the join to see if basic query works
      const { data, error } = await supabase
        .from('networking_requests')
        .select('id, sender_id, status, created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')

      if (error) {
        console.error('Basic query error:', error)
        throw error
      }

      // If basic query works, try with join
      if (data && data.length > 0) {
        const requestIds = data.map(r => r.id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', data.map(r => r.sender_id))

        if (profilesError) {
          console.error('Profiles query error:', profilesError)
        }

        // Combine the data
        const combinedData = data.map(request => ({
          ...request,
          sender_profile: profilesData?.find(p => p.id === request.sender_id) || null
        }))

        setPendingRequests(combinedData)
      } else {
        setPendingRequests([])
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  async function fetchConnections() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // First get the connections
      const { data, error } = await supabase
        .from('networking_requests')
        .select('id, sender_id, receiver_id, status')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      if (error) {
        console.error('Basic connections query error:', error)
        throw error
      }

      // Then get the profiles for the other users
      if (data && data.length > 0) {
        const otherUserIds = data.map(connection =>
          connection.sender_id === user.id ? connection.receiver_id : connection.sender_id
        )

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', otherUserIds)

        if (profilesError) {
          console.error('Profiles query error:', profilesError)
        }

        // Combine the data
        const combinedData = data.map(connection => {
          const otherUserId = connection.sender_id === user.id ? connection.receiver_id : connection.sender_id
          return {
            ...connection,
            sender_profile: connection.sender_id === user.id ? null : profilesData?.find(p => p.id === connection.sender_id) || null,
            receiver_profile: connection.receiver_id === user.id ? null : profilesData?.find(p => p.id === connection.receiver_id) || null
          }
        })

        setConnections(combinedData)
      } else {
        setConnections([])
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    }
  }

  async function handleRequestResponse(requestId: string, status: 'accepted' | 'rejected') {
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('networking_requests')
        .update({ status })
        .eq('id', requestId)

      if (error) throw error

      // Refresh data
      await fetchPendingRequests()
      await fetchConnections()
      alertModal.showAlert(`Connection request ${status}!`, 'Request Updated', status === 'accepted' ? 'success' : status === 'rejected' ? 'warning' : 'info')
    } catch (error) {
      console.error('Error updating request:', error)
      alertModal.showAlert('Failed to update request', 'Error', 'error')
    }
  }

  function handleMessage(otherUserId: string) {
    // Navigate to messages page with the selected user
    router.push(`/messages?user=${otherUserId}`)
  }

  async function handleConnect(receiverId: string) {
    if (!supabase) {
      console.error('Supabase not initialized')
      return
    }
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        alertModal.showAlert('Authentication error. Please log in again.', 'Error', 'error')
        return
      }
      if (!user) {
        console.error('No user found')
        alertModal.showAlert('Please log in to send connection requests', 'Login Required', 'warning')
        return
      }

      // Prevent sending request to yourself
      if (user.id === receiverId) {
        alertModal.showAlert('You cannot send a connection request to yourself', 'Invalid Action', 'warning')
        return
      }

      // Check if user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('User profile not found:', profileError)
        alertModal.showAlert('Please complete your profile setup first', 'Profile Required', 'warning')
        return
      }

      // Check if request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('networking_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing requests:', checkError)
        throw checkError
      }

      if (existingRequest) {
        if (existingRequest.status === 'accepted') {
          alertModal.showAlert('You are already connected with this user', 'Already Connected', 'info')
        } else if (existingRequest.status === 'pending') {
          alertModal.showAlert('Connection request already sent or received', 'Request Exists', 'info')
        } else {
          alertModal.showAlert('Connection request was previously rejected', 'Request Rejected', 'warning')
        }
        return
      }

      console.log('Sending connection request from:', user.id, 'to:', receiverId)

      const { error } = await supabase
        .from('networking_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending'
        })

      if (error) {
        console.error('Error inserting connection request:', error)
        throw error
      }

      console.log('Connection request sent successfully')
      alertModal.showAlert('Connection request sent!', 'Success', 'success')

      // Refresh data
      await fetchUsers()
      await fetchPendingRequests()
      await fetchConnections()
    } catch (error) {
      console.error('Error sending connection request:', error)
      alertModal.showAlert('Failed to send connection request', 'Error', 'error')
    }
  }

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      <main className="pb-16 pt-16">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-violet-400 mb-6 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Networking
          </h1>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-400"
            />
          </div>

          {/* Tabs */}
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'discover'
                  ? 'bg-violet-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors relative ${
                activeTab === 'requests'
                  ? 'bg-violet-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Requests
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'connections'
                  ? 'bg-violet-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Connections ({connections.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'discover' && (
            <>
              {error ? (
                <div className="text-center py-8">
                  <p className="text-red-400">{error}</p>
                  <p className="text-gray-400 mt-2">Please configure Supabase to use this feature.</p>
                </div>
              ) : loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading users...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-400 rounded-full flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-10 h-10 rounded-full" />
                          ) : (
                            <span className="text-black font-semibold text-sm">
                              {(user.full_name || user.email).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{user.full_name || 'Anonymous'}</p>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConnect(user.id)}
                        className="bg-violet-400 text-black px-3 py-1 rounded-full text-sm font-semibold hover:bg-violet-300 transition-colors flex items-center gap-1"
                      >
                        <UserPlus className="h-4 w-4" />
                        Connect
                      </button>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No users found</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-violet-400 rounded-full flex items-center justify-center">
                        {request.sender_profile?.avatar_url ? (
                          <img src={request.sender_profile.avatar_url} alt={request.sender_profile.full_name || request.sender_profile.email} className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-black font-semibold text-sm">
                            {(request.sender_profile?.full_name || request.sender_profile?.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{request.sender_profile?.full_name || 'Anonymous'}</p>
                        <p className="text-sm text-gray-400">{request.sender_profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestResponse(request.id, 'accepted')}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-500 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRequestResponse(request.id, 'rejected')}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="space-y-4">
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No connections yet</p>
                </div>
              ) : (
                connections.map((connection) => {
                  const isCurrentUserSender = connection.sender_id === currentUser?.id
                  const otherUser = isCurrentUserSender
                    ? connection.receiver_profile
                    : connection.sender_profile
                  return (
                    <div key={connection.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-400 rounded-full flex items-center justify-center">
                          {otherUser?.avatar_url ? (
                            <img src={otherUser.avatar_url} alt={otherUser.full_name || otherUser.email} className="w-10 h-10 rounded-full" />
                          ) : (
                            <span className="text-black font-semibold text-sm">
                              {(otherUser?.full_name || otherUser?.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{otherUser?.full_name || 'Anonymous'}</p>
                          <p className="text-sm text-gray-400">{otherUser?.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-green-400 text-sm font-semibold">Connected</div>
                        <button
                          onClick={() => handleMessage(otherUser?.id || (isCurrentUserSender ? connection.receiver_id : connection.sender_id))}
                          className="bg-violet-400 text-black px-3 py-1 rounded-full text-sm font-semibold hover:bg-violet-300 transition-colors flex items-center gap-1"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Message
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </main>
      <BottomNav />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.closeAlert}
        title={alertModal.alertData?.title}
        message={alertModal.alertData?.message || ''}
        type={alertModal.alertData?.type}
      />
    </div>
  )
}