begin;

create extension if not exists pgcrypto;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_package_id uuid,
  receive_date date,
  external_key text,
  normalized_subject text not null default '',
  subject text not null,
  content text not null default '',
  note text not null default '',
  status text not null default 'open' check (status in ('open','doing','done','archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_package_id)
);

create index if not exists cases_user_receive_idx on public.cases(user_id, receive_date desc);
create index if not exists cases_user_subject_idx on public.cases(user_id, normalized_subject);
create unique index if not exists cases_user_external_key_uidx
  on public.cases(user_id, external_key)
  where external_key is not null and external_key <> '' and deleted_at is null;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  channel text not null,
  deadline date,
  status text not null default 'open' check (status in ('open','doing','done')),
  detail text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliveries_case_idx on public.deliveries(case_id, sort_order);
create index if not exists deliveries_deadline_idx on public.deliveries(deadline) where status <> 'done';

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  format text not null default 'other'
    check (format in ('doc','docx','xls','xlsx','pdf','csv','txt','paper','online_form','other')),
  source_type text not null default 'generated'
    check (source_type in ('official_template','reconstructed','generated','user_upload','chatgpt_output')),
  reference text not null default '',
  status text not null default 'missing'
    check (status in ('missing','draft','ready','submitted')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_documents_case_idx on public.case_documents(case_id, sort_order);

create table if not exists public.document_deliveries (
  document_id uuid not null references public.case_documents(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  primary key (document_id, delivery_id)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.case_documents(id) on delete cascade,
  role text not null check (role in ('template','draft','final')),
  source_type text not null
    check (source_type in ('official_template','reconstructed','generated','user_upload','chatgpt_output')),
  version_number integer not null check (version_number > 0),
  version_label text not null,
  file_name text not null,
  storage_path text not null unique,
  media_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  is_current boolean not null default false,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create unique index if not exists document_versions_current_role_uidx
  on public.document_versions(document_id, role)
  where is_current;

create table if not exists public.case_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  package_id uuid not null,
  schema_version text not null,
  package_sha256 text check (package_sha256 is null or package_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'validating'
    check (status in ('validating','staged','committing','completed','failed')),
  case_id uuid references public.cases(id) on delete set null,
  duplicate_of_case_id uuid references public.cases(id) on delete set null,
  force_import boolean not null default false,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, package_id)
);

create index if not exists case_imports_user_created_idx on public.case_imports(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_case_subject()
returns trigger language plpgsql as $
begin
  new.normalized_subject = lower(regexp_replace(trim(new.subject), '[[:space:][:punct:]]+', '', 'g'));
  return new;
end;
$;

drop trigger if exists cases_normalize_subject on public.cases;
create trigger cases_normalize_subject before insert or update of subject on public.cases
for each row execute function public.normalize_case_subject();

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at before update on public.cases
for each row execute function public.set_updated_at();

drop trigger if exists deliveries_set_updated_at on public.deliveries;
create trigger deliveries_set_updated_at before update on public.deliveries
for each row execute function public.set_updated_at();

drop trigger if exists case_documents_set_updated_at on public.case_documents;
create trigger case_documents_set_updated_at before update on public.case_documents
for each row execute function public.set_updated_at();

alter table public.cases enable row level security;
alter table public.deliveries enable row level security;
alter table public.case_documents enable row level security;
alter table public.document_deliveries enable row level security;
alter table public.document_versions enable row level security;
alter table public.case_imports enable row level security;

create policy "cases_owner_all" on public.cases for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "deliveries_owner_all" on public.deliveries for all
using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()))
with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

create policy "case_documents_owner_all" on public.case_documents for all
using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()))
with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

create policy "document_deliveries_owner_all" on public.document_deliveries for all
using (
  exists (
    select 1 from public.case_documents d
    join public.cases c on c.id = d.case_id
    where d.id = document_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.case_documents d
    join public.deliveries x on x.id = delivery_id and x.case_id = d.case_id
    join public.cases c on c.id = d.case_id
    where d.id = document_id and c.user_id = auth.uid()
  )
);

create policy "document_versions_owner_all" on public.document_versions for all
using (
  exists (
    select 1 from public.case_documents d
    join public.cases c on c.id = d.case_id
    where d.id = document_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.case_documents d
    join public.cases c on c.id = d.case_id
    where d.id = document_id and c.user_id = auth.uid()
  )
);

create policy "case_imports_owner_all" on public.case_imports for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-files',
  'case-files',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "case_files_owner_select" on storage.objects for select
using (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "case_files_owner_insert" on storage.objects for insert
with check (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "case_files_owner_update" on storage.objects for update
using (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "case_files_owner_delete" on storage.objects for delete
using (
  bucket_id = 'case-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
