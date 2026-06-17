create index if not exists app_state_items_created_by_idx
  on public.app_state_items (created_by);

create index if not exists app_state_items_updated_by_idx
  on public.app_state_items (updated_by);
