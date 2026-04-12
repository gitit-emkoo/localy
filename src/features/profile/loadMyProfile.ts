import { supabase } from '@/src/lib/supabase/client';

export type MyProfileRow = {
  id: string;
  nickname: string;
  age: number;
  country_code: string;
  country_name: string;
  short_bio: string;
  intro: string | null;
};

export async function loadMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) {
    return { data: null, error: new Error('Not signed in') } as const;
  }

  const profileRes = await supabase
    .from('user_profiles')
    .select('id, nickname, age, country_code, country_name, short_bio, intro')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (profileRes.error) {
    return { data: null, error: profileRes.error } as const;
  }
  if (!profileRes.data) {
    return { data: null, error: null } as const;
  }

  const profile = profileRes.data as MyProfileRow;
  const intRes = await supabase.from('user_interests').select('interest_key').eq('user_id', profile.id);

  if (intRes.error) {
    return { data: null, error: intRes.error } as const;
  }

  const interestKeys = (intRes.data ?? []).map((r) => String(r.interest_key));
  return { data: { profile, interestKeys }, error: null } as const;
}
