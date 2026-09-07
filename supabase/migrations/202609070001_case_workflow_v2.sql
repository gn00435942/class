begin;

alter table public.case_documents
  drop constraint if exists case_documents_status_check;

update public.case_documents
set status = case status
  when 'missing' then 'not_started'
  when 'draft' then 'in_progress'
  when 'ready' then 'completed'
  else status
end;

alter table public.case_documents
  add constraint case_documents_status_check
  check (status in (
    'not_started',
    'in_progress',
    'pending_approval',
    'completed',
    'submitted',
    'not_required'
  ));

alter table public.case_documents
  add column if not exists category text not null default 'deliverable'
    check (category in ('deliverable', 'reference')),
  add column if not exists required boolean not null default true,
  add column if not exists completed_at timestamptz,
  add column if not exists submitted_at timestamptz;

update public.case_documents
set required = false
where category = 'reference';

alter table public.deliveries
  add column if not exists target text not null default '';

create index if not exists case_documents_case_category_idx
  on public.case_documents(case_id, category, sort_order);

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png'
]
where id = 'case-files';

commit;
