import { redirect } from 'next/navigation';

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const { code, next } = await searchParams;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  }
  redirect('/dashboard');
}
