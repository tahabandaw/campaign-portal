import { createClient } from '@/lib/supabase/server';
import { formatNumber, formatDate } from '@/lib/utils';
import { ContactsTable } from '@/components/contacts-table';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    consent?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1'));
  const search = params.search || '';
  const statusFilter = params.status || '';
  const consentFilter = params.consent || '';

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: brandUser } = await supabase
    .from('brand_users')
    .select('brand_id')
    .eq('user_id', user.id)
    .single();

  if (!brandUser) return <div className="p-8">No brand assigned.</div>;

  const brandId = brandUser.brand_id;

  // Build query
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('brand_id', brandId)
    .order('signup_at', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Apply search filter
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply status filter
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Apply consent filter
  if (consentFilter === 'true') {
    query = query.eq('consent_marketing', true);
  } else if (consentFilter === 'false') {
    query = query.eq('consent_marketing', false);
  }

  const { data: contacts, count } = await query;

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatNumber(count || 0)} total contacts
          {search && ` matching "${search}"`}
          {statusFilter && ` with status "${statusFilter}"`}
          {consentFilter && ` with consent=${consentFilter}`}
        </p>
      </div>

      <ContactsTable
        contacts={contacts || []}
        totalCount={count || 0}
        currentPage={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        search={search}
        statusFilter={statusFilter}
        consentFilter={consentFilter}
      />
    </div>
  );
}
