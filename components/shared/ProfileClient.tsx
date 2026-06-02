'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { CldUploadWidget } from 'next-cloudinary';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer', smo: 'Social Media', manager: 'Manager',
  admin: 'Admin', ceo: 'CEO', hr: 'HR', developer: 'Developer',
};

const ROLE_COLORS: Record<string, string> = {
  designer: 'bg-purple-100 text-purple-800',
  smo:      'bg-blue-100 text-blue-800',
  manager:  'bg-amber-100 text-amber-800',
  admin:    'bg-red-100 text-red-800',
  ceo:      'bg-emerald-100 text-emerald-800',
  hr:       'bg-pink-100 text-pink-800',
  developer:'bg-cyan-100 text-cyan-800',
};

interface Profile {
  id: string;
  full_name: string;
  role: string;
  auth_email: string;
  whatsapp_number: string | null;
  avatar_url: string | null;
  created_at: string;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);
  return (
    <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold select-none">
      {initials.toUpperCase()}
    </div>
  );
}

export function ProfileClient({ profile: initial }: { profile: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [fullName, setFullName] = useState(initial.full_name);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp_number ?? '');
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  async function saveProfile() {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, whatsapp_number: whatsapp }),
      });
      if (!res.ok) throw new Error();
      setProfile(p => ({ ...p, full_name: fullName, whatsapp_number: whatsapp || null }));
      toast.success('Profile updated.');
    } catch {
      toast.error('Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAvatarUrl(url: string) {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: url }),
    });
    if (res.ok) {
      setProfile(p => ({ ...p, avatar_url: url }));
      toast.success('Avatar updated.');
    } else {
      toast.error('Could not save avatar.');
    }
  }

  async function changePassword() {
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match.');
      return;
    }
    setChangingPw(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.auth_email,
        password: currentPw,
      });
      if (signInError) {
        toast.error('Current password is incorrect.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success('Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch {
      toast.error('Could not change password.');
    } finally {
      setChangingPw(false);
    }
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="rounded-xl border bg-card p-6 flex items-center gap-5">
        {/* Avatar with upload overlay */}
        <CldUploadWidget
          uploadPreset="bardbox_avatars"
          options={{ maxFiles: 1, resourceType: 'image', cropping: true, croppingAspectRatio: 1, folder: 'bardbox/avatars', sources: ['local', 'url', 'camera', 'dropbox', 'google_drive', 'unsplash'] }}
          onSuccess={(result) => {
            const info = result.info as { secure_url?: string };
            if (info?.secure_url) saveAvatarUrl(info.secure_url);
          }}
        >
          {({ open }) => (
            <button
              onClick={() => open()}
              className="relative group shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Change avatar"
            >
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  width={80}
                  height={80}
                  className="size-20 rounded-full object-cover"
                />
              ) : (
                <Initials name={profile.full_name} />
              )}
              <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="size-5 text-white" />
              </span>
            </button>
          )}
        </CldUploadWidget>

        <div className="space-y-1">
          <p className="text-xl font-semibold">{profile.full_name}</p>
          <p className="text-sm text-muted-foreground">{profile.auth_email}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[profile.role] ?? 'bg-muted text-muted-foreground'}`}>
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
            <span className="text-xs text-muted-foreground">Member since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Edit details */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Personal Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp Number</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="+92 300 0000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.auth_email} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input value={ROLE_LABELS[profile.role] ?? profile.role} disabled className="opacity-60 capitalize" />
            <p className="text-xs text-muted-foreground">Contact admin to change your role.</p>
          </div>
        </div>
        <Button onClick={saveProfile} disabled={saving || !fullName.trim()}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Change password */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="current_pw">Current Password</Label>
            <Input
              id="current_pw" type="password"
              value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new_pw">New Password</Label>
            <Input
              id="new_pw" type="password"
              value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_pw">Confirm New Password</Label>
            <Input
              id="confirm_pw" type="password"
              value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={changePassword}
          disabled={changingPw || !currentPw || !newPw || !confirmPw}
        >
          {changingPw ? 'Changing…' : 'Change Password'}
        </Button>
      </div>
    </div>
  );
}
