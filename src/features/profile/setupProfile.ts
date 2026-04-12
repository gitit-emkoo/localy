import { supabase } from '@/src/lib/supabase/client';
import type { MvpCountryCode } from '@/src/types/domain';
import type { InterestKey } from '@/src/constants/profile';

export type ProfileSetupInput = {
  nickname: string;
  age: number;
  countryCode: MvpCountryCode;
  countryName: string;
  shortBio: string;
  intro?: string;
  profileImageUrl?: string;
  interests: InterestKey[];
};

export async function setupProfile(input: ProfileSetupInput) {
  const { data: auth } = await supabase.auth.getUser();
  const authUserId = auth.user?.id;
  if (!authUserId) {
    return { error: new Error('Not signed in') } as const;
  }

  // user_profiles upsert
  const upsertRes = await supabase
    .from('user_profiles')
    .upsert(
      {
        auth_user_id: authUserId,
        nickname: input.nickname,
        age: input.age,
        country_code: input.countryCode,
        country_name: input.countryName,
        short_bio: input.shortBio,
        intro: input.intro ?? null,
        profile_image_url: input.profileImageUrl ?? null,
        is_profile_completed: true,
      },
      { onConflict: 'auth_user_id' },
    )
    .select('id')
    .single();

  if (upsertRes.error) {
    return { error: upsertRes.error } as const;
  }

  const userProfileId = upsertRes.data.id as string;

  // interests: replace strategy (delete then insert)
  const delRes = await supabase.from('user_interests').delete().eq('user_id', userProfileId);
  if (delRes.error) {
    return { error: delRes.error } as const;
  }

  const insertRows = input.interests.map((k) => ({ user_id: userProfileId, interest_key: k }));
  const insRes = await supabase.from('user_interests').insert(insertRows);
  if (insRes.error) {
    return { error: insRes.error } as const;
  }

  return { error: null } as const;
}
