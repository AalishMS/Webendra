-- Run once in a Webendra Supabase project, then enable anonymous
-- sign-ins and Cloudflare Turnstile in Authentication settings.

create table if not exists public.review_characters (
  slug text primary key check (slug ~ '^[a-z]+$')
);

alter table public.review_characters enable row level security;
revoke all on public.review_characters from public, anon, authenticated;
grant select on public.review_characters to anon, authenticated;
create policy "Published characters are public"
on public.review_characters for select to anon, authenticated using (true);

insert into public.review_characters (slug) values
  ('ballendra'), ('birendra'), ('dogendra'), ('bonendra'), ('ramendra'),
  ('fishendra'), ('dipendra'), ('rabindra'), ('gyanendra'), ('belendra'),
  ('devendra'), ('tapendra'), ('ganendra'), ('topendra'), ('chillendra'),
  ('jugendra'), ('cylendra'), ('yogendra'), ('hugendra'), ('shailendra'),
  ('bartendra'), ('deffendra'), ('pretendra'), ('blendra'), ('calendra'),
  ('lokendra'), ('peakendra')
on conflict do nothing;

create table if not exists public.review_entries (
  id bigint generated always as identity primary key,
  character_slug text not null references public.review_characters(slug),
  user_id uuid not null default auth.uid(),
  rating smallint not null check (rating between 1 and 5),
  nickname text,
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, character_slug),
  constraint review_text_and_name check (
    (review is null and nickname is null)
    or (review is not null and nickname is not null
      and char_length(review) between 1 and 500
      and char_length(nickname) between 2 and 30
      and review = btrim(review)
      and nickname = btrim(nickname))
  )
);

create index if not exists review_entries_character_idx
  on public.review_entries (character_slug);
create index if not exists review_entries_latest_idx
  on public.review_entries (character_slug, created_at desc, id desc)
  where review is not null;

create or replace function public.touch_review_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_review_updated_at() from public, anon, authenticated;
create trigger review_entries_touch_updated_at
before update on public.review_entries
for each row execute function public.touch_review_updated_at();

alter table public.review_entries enable row level security;
revoke all on public.review_entries from public, anon, authenticated;
grant select (id, character_slug, rating, nickname, review, created_at, updated_at)
  on public.review_entries to anon;
grant select (id, character_slug, rating, nickname, review, created_at, updated_at)
  on public.review_entries to authenticated;
grant insert (character_slug, rating, nickname, review)
  on public.review_entries to authenticated;
grant update (rating, nickname, review)
  on public.review_entries to authenticated;
grant usage on sequence public.review_entries_id_seq to authenticated;

create policy "Ratings and reviews are public"
on public.review_entries for select to anon, authenticated using (true);
create policy "Guests create only their own rating"
on public.review_entries for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Guests revise only their own rating"
on public.review_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.own_review(requested_slug text)
returns table (id bigint, rating smallint, nickname text, review text)
language sql stable security definer set search_path = '' as $$
  select entries.id, entries.rating, entries.nickname, entries.review
  from public.review_entries as entries
  where entries.user_id = (select auth.uid())
    and entries.character_slug = requested_slug
  limit 1;
$$;

revoke all on function public.own_review(text) from public, anon;
grant execute on function public.own_review(text) to authenticated;

create or replace view public.review_summary
with (security_invoker = true) as
select character_slug,
  count(*)::integer as rating_count,
  round(avg(rating)::numeric, 1) as average_rating,
  count(review)::integer as review_count
from public.review_entries
group by character_slug;

revoke all on public.review_summary from public, anon, authenticated;
grant select on public.review_summary to anon, authenticated;
