"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import BottomNav from "@/components/bottomNavbar"
import TopNav from "@/components/TopNav"
import { Heart, MessageCircle, Share } from "lucide-react"
import AlertModal, { useAlertModal } from "@/components/ui/alert-modal"

export const dynamic = 'force-dynamic'

type Post = {
  id: string
  content: string
  image_url?: string
  created_at: string
  author_id: string
  profiles: {
    full_name?: string
    avatar_url?: string
    email: string
  }
  post_comments?: {
    id: string
    content: string
    created_at: string
    author_id: string
    profiles: {
      full_name?: string
    }
  }[]
  post_likes?: {
    id: string
    user_id: string
  }[]
  user_has_liked?: boolean
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [postsCount, setPostsCount] = useState(0)
  const [connectionsCount, setConnectionsCount] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [newComments, setNewComments] = useState<{[key: string]: string}>({})
  const alertModal = useAlertModal()
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
    fetchPosts()
    fetchUserData()
  }, [supabase])

  async function fetchPosts() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            full_name,
            avatar_url,
            email
          ),
          post_comments (
            id,
            content,
            created_at,
            author_id,
            profiles:author_id (
              full_name
            )
          ),
          post_likes (
            id,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Add user_has_liked flag to each post
      const postsWithLikes = data?.map(post => ({
        ...post,
        user_has_liked: user ? post.post_likes?.some((like: any) => like.user_id === user.id) : false
      })) || []

      setPosts(postsWithLikes)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setError('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  async function toggleLike(postId: string) {
    if (!supabase) {
      console.error('Supabase not initialized')
      return
    }
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        return
      }
      if (!user) {
        console.error('No user found')
        alertModal.showAlert('Please log in to like posts', 'Login Required', 'warning')
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

      const post = posts.find(p => p.id === postId)
      if (!post) {
        console.error('Post not found:', postId)
        return
      }

      console.log('Toggling like for post:', postId, 'user:', user.id, 'currently liked:', post.user_has_liked)

      if (post.user_has_liked) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error deleting like:', error)
          throw error
        }
        console.log('Like deleted successfully')
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          })

        if (error) {
          console.error('Error inserting like:', error)
          throw error
        }
        console.log('Like inserted successfully')
      }

      // Refresh posts to update like counts
      await fetchPosts()
    } catch (error) {
      console.error('Error toggling like:', error)
      alertModal.showAlert('Failed to toggle like. Please try again.', 'Error', 'error')
    }
  }

  async function addComment(postId: string) {
    if (!supabase) {
      console.error('Supabase not initialized')
      return
    }
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        return
      }
      if (!user) {
        console.error('No user found')
        return
      }

      const commentText = newComments[postId]?.trim()
      if (!commentText) {
        console.error('No comment text')
        return
      }

      console.log('Adding comment for post:', postId, 'user:', user.id, 'comment:', commentText)

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: commentText
        })

      if (error) {
        console.error('Error inserting comment:', error)
        throw error
      }

      console.log('Comment inserted successfully')

      // Clear the comment input
      setNewComments(prev => ({ ...prev, [postId]: '' }))

      // Refresh posts to show new comment
      await fetchPosts()
    } catch (error) {
      console.error('Error adding comment:', error)
      alertModal.showAlert('Failed to add comment. Please try again.', 'Error', 'error')
    }
  }

  function toggleComments(postId: string) {
    setExpandedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  async function fetchUserData() {
    if (!supabase) return
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.user.id)
        .single()
      setUserProfile(profile)

      // Fetch counts
      const [postsRes, connectionsRes, messagesRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact' }).eq('author_id', user.user.id),
        supabase.from('networking_requests').select('id', { count: 'exact' }).or(`sender_id.eq.${user.user.id},receiver_id.eq.${user.user.id}`).eq('status', 'accepted'),
        supabase.from('messages').select('id', { count: 'exact' }).or(`sender_id.eq.${user.user.id},receiver_id.eq.${user.user.id}`)
      ])

      setPostsCount(postsRes.count || 0)
      setConnectionsCount(connectionsRes.count || 0)
      setMessagesCount(messagesRes.count || 0)
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }  if (!isClient) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />
      <main className="pb-16">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-violet-400 mb-6">Home Feed</h1>

          {/* Welcome Section */}
          {userProfile && (
            <div className="bg-gradient-to-r from-violet-400 to-violet-600 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Welcome back, {userProfile.full_name || 'User'}!</h2>
              <div className="grid grid-cols-3 gap-4 text-black">
                <div className="text-center">
                  <p className="text-3xl font-bold">{postsCount}</p>
                  <p className="text-sm">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{connectionsCount}</p>
                  <p className="text-sm">Connections</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{messagesCount}</p>
                  <p className="text-sm">Messages</p>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
              <p className="text-gray-400 mt-2">Please configure Supabase to use this app.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-violet-400 rounded-full flex items-center justify-center">
                      {post.profiles.avatar_url ? (
                        <img src={post.profiles.avatar_url} alt={post.profiles.full_name || post.profiles.email} className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="text-black font-semibold">
                          {(post.profiles.full_name || post.profiles.email).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{post.profiles.full_name || 'Anonymous'}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <p className="text-white mb-3">{post.content}</p>

                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="w-full rounded-lg mb-3"
                    />
                  )}

                  <div className="flex items-center gap-6 text-gray-400">
                    <button 
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1 transition-colors ${
                        post.user_has_liked ? 'text-red-400 hover:text-red-300' : 'hover:text-violet-400'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${post.user_has_liked ? 'fill-current' : ''}`} />
                      <span className="text-sm">{post.post_likes?.length || 0}</span>
                    </button>
                    <button 
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1 hover:text-violet-400 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm">{post.post_comments?.length || 0}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-violet-400 transition-colors">
                      <Share className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Add Comment Section */}
                  {expandedComments.has(post.id) && (
                    <div className="mt-4 space-y-3">
                      {/* Comment Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newComments[post.id] || ''}
                          onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-400 text-sm"
                        />
                        <button
                          onClick={() => addComment(post.id)}
                          disabled={!newComments[post.id]?.trim()}
                          className="bg-violet-400 text-black px-4 py-2 rounded-lg hover:bg-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                        >
                          Post
                        </button>
                      </div>

                      {/* Comments List */}
                      {post.post_comments && post.post_comments.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {post.post_comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-700 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-violet-400">
                                  {comment.profiles?.full_name || 'Anonymous'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-white">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
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
