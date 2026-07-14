'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
      Sair
    </button>
  );
}
