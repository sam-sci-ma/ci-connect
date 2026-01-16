"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import BottomNav from "@/components/bottomNavbar"
import TopNav from "@/components/TopNav"
import { PlusSquare, Image, Send, X } from "lucide-react"
import AlertModal, { useAlertModal } from "@/components/ui/alert-modal"

export const dynamic = 'force-dynamic'

export default function PostPage() {
  const [content, setContent] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !supabase) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      let imageUrl = null

      // Upload image if provided
      if (image) {
        const fileExt = image.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, image)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath)

        imageUrl = publicUrl
      }

      // Create post
      const { error } = await supabase
        .from('posts')
        .insert({
          content,
          image_url: imageUrl,
          author_id: user.id,
          post_type: 'general'
        })

      if (error) throw error

      setContent("")
      setImage(null)
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
        setImagePreview(null)
      }
      router.push("/")
    } catch (error) {
      console.error('Error creating post:', error)
      alertModal.showAlert('Error creating post. Please try again.', 'Error', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alertModal.showAlert('Please select a valid image file.', 'Invalid File', 'warning')
        return
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alertModal.showAlert('Image size must be less than 5MB.', 'File Too Large', 'warning')
        return
      }

      setImage(file)
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    }
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImage(null)
    setImagePreview(null)
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
      <main className="pb-16 pt-16">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-violet-400 mb-6 flex items-center gap-2">
            <PlusSquare className="h-6 w-6" />
            Create Post
          </h1>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-400">{error}</p>
              <p className="text-gray-400 mt-2">Please configure Supabase to create posts.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-400 resize-none"
              required
            />

            {/* Image Upload */}
            <div className="space-y-2">
              {!imagePreview ? (
                <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-dashed border-gray-600 rounded-lg hover:border-violet-400 transition-colors">
                  <Image className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-400">Add image to your post</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-300">
                    Image selected: {image?.name}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="w-full bg-violet-400 text-black py-3 rounded-lg font-semibold hover:bg-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Post
                </>
              )}
            </button>
          </form>
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