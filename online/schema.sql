-- RE:FLEET online storage, migration 001. Run once on a new Supabase project.
begin;
create table public.refleet_sheets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 3145728),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 share_token uuid unique,
 check (revision > 0)
);
alter table public.refleet_sheets enable row level security;
create policy own_read on public.refleet_sheets for select to authenticated using (owner_id = (select auth.uid()));
create policy own_delete on public.refleet_sheets for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.refleet_sheets from anon, authenticated;
grant select, delete on public.refleet_sheets to authenticated;
create index refleet_sheets_owner on public.refleet_sheets(owner_id);

-- Writes pass through this RPC to prevent accidental stale-tab overwrites.
create function public.refleet_save(p_data jsonb, p_id uuid default null, p_revision bigint default null)
returns public.refleet_sheets language plpgsql security definer set search_path = '' as $$
declare result public.refleet_sheets;
begin
 if auth.uid() is null then raise exception 'login_required'; end if;
 if p_id is null then
  insert into public.refleet_sheets(owner_id, data) values(auth.uid(), p_data) returning * into result;
 else
  update public.refleet_sheets set data=p_data, revision=revision+1, updated_at=now()
  where id=p_id and owner_id=auth.uid() and revision=p_revision returning * into result;
  if not found then raise exception 'revision_conflict'; end if;
 end if;
 return result;
end; $$;

create function public.refleet_share(p_id uuid, p_enabled boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare token uuid;
begin
 if auth.uid() is null then raise exception 'login_required'; end if;
 update public.refleet_sheets set share_token=case when p_enabled then coalesce(share_token,gen_random_uuid()) else null end
 where id=p_id and owner_id=auth.uid() returning share_token into token;
 if not found then raise exception 'not_found'; end if;
 return token;
end; $$;

-- No public SELECT/listing of the table. Read only the one unguessable shared token.
-- Never return owner_id, email, or any authentication data.
create function public.refleet_read_shared(p_token uuid)
returns table(data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select s.data, s.updated_at from public.refleet_sheets s where s.share_token=p_token;
$$;
revoke all on function public.refleet_save(jsonb,uuid,bigint) from public, anon;
revoke all on function public.refleet_share(uuid,boolean) from public, anon;
revoke all on function public.refleet_read_shared(uuid) from public;
grant execute on function public.refleet_save(jsonb,uuid,bigint) to authenticated;
grant execute on function public.refleet_share(uuid,boolean) to authenticated;
grant execute on function public.refleet_read_shared(uuid) to anon,authenticated;
commit;
