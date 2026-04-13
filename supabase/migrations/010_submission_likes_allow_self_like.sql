-- Allow liking own submission (same user as submission owner); policy was blocking self-hearts.

drop policy if exists "submission_likes_insert_valid" on public.submission_likes;

create policy "submission_likes_insert_valid" on public.submission_likes
for insert to authenticated
with check (
  submission_likes.user_id = (select p.id from public.user_profiles p where p.auth_user_id = auth.uid())
  and exists (
    select 1 from public.submissions s
    where s.id = submission_likes.submission_id
  )
  and exists (
    select 1 from public.result_cards rc
    where (rc.submission_a_id = submission_likes.submission_id or rc.submission_b_id = submission_likes.submission_id)
      and public.can_view_result_card(rc.id)
  )
);
