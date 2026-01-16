"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import BottomNav from "@/components/bottomNavbar"
import TopNav from "@/components/TopNav"
import { User, Settings, LogOut, Edit, X, Camera } from "lucide-react"
import AlertModal, { useAlertModal } from "@/components/ui/alert-modal"

export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  bio?: string
  institution?: string
  degree_program?: string
  graduation_year?: number
  program_type?: 'executive' | 'fundamental'
  status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
  last_seen_at?: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ 
    full_name: "", 
    bio: "",
    institution: "",
    degree_program: "",
    graduation_year: "",
    program_type: "fundamental" as 'executive' | 'fundamental'
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alertModal = useAlertModal()
  const router = useRouter()
  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch (err) {
      setError('Supabase not configured')
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    fetchProfile()
  }, [supabase])

  async function fetchProfile() {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile(data)
        setEditForm({ 
          full_name: data.full_name || "", 
          bio: data.bio || "",
          institution: data.institution || "",
          degree_program: data.degree_program || "",
          graduation_year: data.graduation_year?.toString() || "",
          program_type: data.program_type || "fundamental"
        })
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || "",
            avatar_url: user.user_metadata?.avatar_url || "",
            program_type: "fundamental"
          })
          .select()
          .single()

        if (insertError) throw insertError
        setProfile(newProfile)
        setEditForm({ 
          full_name: newProfile.full_name || "", 
          bio: newProfile.bio || "",
          institution: newProfile.institution || "",
          degree_program: newProfile.degree_program || "",
          graduation_year: newProfile.graduation_year?.toString() || "",
          program_type: newProfile.program_type || "fundamental"
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile() {
    if (!profile || !supabase) return

    try {
      let avatarUrl = profile.avatar_url

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `avatar-${profile.id}-${Date.now()}.${fileExt}`
        const filePath = `${profile.id}/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrl
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          institution: editForm.institution,
          degree_program: editForm.degree_program,
          graduation_year: editForm.graduation_year ? parseInt(editForm.graduation_year) : null,
          program_type: editForm.program_type,
          avatar_url: avatarUrl
        })
        .eq('id', profile.id)

      if (error) throw error

      setProfile({ 
        ...profile, 
        ...editForm, 
        graduation_year: editForm.graduation_year ? parseInt(editForm.graduation_year) : undefined,
        avatar_url: avatarUrl
      })
      
      // Clean up preview URL
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview)
      }
      
      setAvatarFile(null)
      setAvatarPreview(null)
      setEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      alertModal.showAlert('Error updating profile. Please try again.', 'Error', 'error')
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alertModal.showAlert('Please select a valid image file.', 'Invalid File', 'warning')
        return
      }

      // Validate file size (2MB limit for avatars)
      if (file.size > 2 * 1024 * 1024) {
        alertModal.showAlert('Avatar size must be less than 2MB.', 'File Too Large', 'warning')
        return
      }

      setAvatarFile(file)
      const previewUrl = URL.createObjectURL(file)
      setAvatarPreview(previewUrl)
    }
  }

  function removeAvatar() {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-gray-400">Please configure Supabase to view your profile.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Profile not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />
      <main className="pb-16 pt-16">
        <div className="max-w-md mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-violet-400 mb-6 flex items-center gap-2">
            <User className="h-6 w-6" />
            Profile
          </h1>

          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 bg-violet-400 rounded-full flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-24 h-24 object-cover" />
                  ) : profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || profile.email} className="w-24 h-24 object-cover" />
                  ) : (
                    <span className="text-black font-bold text-2xl">
                      {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {editing && (
                  <label className="absolute bottom-0 right-0 bg-violet-400 text-black p-2 rounded-full cursor-pointer hover:bg-violet-300 transition-colors">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                )}
                {avatarPreview && (
                  <button
                    onClick={removeAvatar}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile Info */}
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Institution</label>
                  <input
                    type="text"
                    value={editForm.institution}
                    onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400"
                    placeholder="Your university or institution"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Degree Program</label>
                  <input
                    type="text"
                    value={editForm.degree_program}
                    onChange={(e) => setEditForm({ ...editForm, degree_program: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400"
                    placeholder="e.g., Computer Science, Business Administration"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Graduation Year</label>
                  <input
                    type="number"
                    value={editForm.graduation_year}
                    onChange={(e) => setEditForm({ ...editForm, graduation_year: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400"
                    placeholder="e.g., 2025"
                    min="2020"
                    max="2030"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Program Type</label>
                  <select
                    value={editForm.program_type}
                    onChange={(e) => setEditForm({ ...editForm, program_type: e.target.value as 'executive' | 'fundamental' })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-violet-400"
                  >
                    <option value="fundamental">Fundamental</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={updateProfile}
                    className="flex-1 bg-violet-400 text-black py-2 rounded-lg font-semibold hover:bg-violet-300 transition-colors"
                  >
                    Save Profile
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 bg-gray-700 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{profile.full_name || 'Anonymous'}</h2>
                  <p className="text-gray-400">{profile.email}</p>
                  {profile.status && (
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                      profile.status === 'approved' ? 'bg-green-600 text-white' :
                      profile.status === 'rejected' ? 'bg-red-600 text-white' :
                      'bg-yellow-600 text-white'
                    }`}>
                      {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-1">Bio</h3>
                    <p className="text-gray-300">{profile.bio}</p>
                  </div>
                )}

                {(profile.institution || profile.degree_program || profile.graduation_year) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">Education</h3>
                    <div className="space-y-1 text-sm">
                      {profile.institution && <p className="text-gray-300">{profile.institution}</p>}
                      {profile.degree_program && <p className="text-gray-300">{profile.degree_program}</p>}
                      {profile.graduation_year && <p className="text-gray-300">Class of {profile.graduation_year}</p>}
                    </div>
                  </div>
                )}

                {profile.program_type && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-1">Program Type</h3>
                    <span className="inline-block px-3 py-1 bg-violet-400 text-black text-sm rounded-full">
                      {profile.program_type.charAt(0).toUpperCase() + profile.program_type.slice(1)}
                    </span>
                  </div>
                )}

                {profile.last_seen_at && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-1">Last Seen</h3>
                    <p className="text-gray-400 text-sm">
                      {new Date(profile.last_seen_at).toLocaleDateString()} at {new Date(profile.last_seen_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setEditing(true)}
                  className="w-full bg-violet-400 text-black py-2 rounded-lg font-semibold hover:bg-violet-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <button className="w-full flex items-center gap-3 p-3 text-left text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
                <Settings className="h-5 w-5" />
                Settings
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 p-3 text-left text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
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