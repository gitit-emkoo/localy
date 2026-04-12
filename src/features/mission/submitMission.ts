import { CAPTION_MAX } from '@/src/constants/profile';
import { supabase } from '@/src/lib/supabase/client';
import * as FileSystemLegacy from 'expo-file-system/legacy';

import { compressMissionPhoto } from '@/src/features/mission/compressMissionImage';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/=+$/, '');
  const bytes: number[] = [];

  let i = 0;
  while (i < cleaned.length) {
    const c1 = chars.indexOf(cleaned.charAt(i++));
    const c2 = chars.indexOf(cleaned.charAt(i++));
    const c3 = chars.indexOf(cleaned.charAt(i++));
    const c4 = chars.indexOf(cleaned.charAt(i++));

    const b1 = (c1 << 2) | (c2 >> 4);
    bytes.push(b1 & 255);

    if (c3 >= 0) {
      const b2 = ((c2 & 15) << 4) | (c3 >> 2);
      bytes.push(b2 & 255);
    }
    if (c4 >= 0) {
      const b3 = ((c3 & 3) << 6) | c4;
      bytes.push(b3 & 255);
    }
  }

  return Uint8Array.from(bytes).buffer;
}

export async function submitMissionPhoto(input: {
  teamId: string;
  missionId: string;
  profileId: string;
  localImageUri: string;
  imageWidth: number;
  imageHeight: number;
  caption: string;
}) {
  try {
    const caption = input.caption.trim().slice(0, CAPTION_MAX);

    const compressedUri = await compressMissionPhoto(
      input.localImageUri,
      input.imageWidth,
      input.imageHeight,
    );

    const path = `${input.teamId}/${input.profileId}/${Date.now()}.jpg`;
    const base64 = await FileSystemLegacy.readAsStringAsync(compressedUri, {
      encoding: 'base64' as any,
    });
    const fileBytes = base64ToArrayBuffer(base64);

    const up = await supabase.storage.from('mission-photos').upload(path, fileBytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (up.error) {
      return { error: new Error(`storage_upload_failed: ${up.error.message}`) } as const;
    }

    const ins = await supabase.from('submissions').insert({
      team_id: input.teamId,
      mission_id: input.missionId,
      user_id: input.profileId,
      photo_url: path,
      caption_original: caption,
      status: 'submitted',
    });

    if (ins.error) {
      return { error: new Error(`submission_insert_failed: ${ins.error.message}`) } as const;
    }

    return { error: null } as const;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    return { error: new Error(`submit_exception: ${message}`) } as const;
  }
}
