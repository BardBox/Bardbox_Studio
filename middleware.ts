import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware-client';
import { ROLE_DEFAULT_ROUTES } from '@/lib/nav';

const ROLE_HOME: Record<string, string> = {
  designer:  '/designer',
  smo:       '/smo',
  manager:   '/manager',
  ceo:       '/ceo',
  hr:        '/hr',
  admin:     '/manager',
  developer: '/developer',
};

// Always accessible to any authenticated user regardless of role
const ALWAYS_ALLOWED = ['/profile', '/request-task', '/set-password'];

async function getDbRoutes(role: string): Promise<string[]> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/role_permissions?role=eq.${encodeURIComponent(role)}&enabled=eq.true&select=route`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const rows: { route: string }[] = await res.json();
    return rows.map((r) => r.route);
  } catch {
    return [];
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareClient(request, response);

  // Validates JWT and refreshes session cookie — no extra DB call
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (pathname === '/login' || pathname.startsWith('/auth')) return response;
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Let auth callback and set-password through for any authenticated user
  if (pathname.startsWith('/auth') || ALWAYS_ALLOWED.some(p => pathname.startsWith(p))) {
    return response;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? '';

  // Redirect away from login/root to role home
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url));
  }

  // Hardcoded defaults — always included regardless of DB state
  const defaultRoutes: string[] = ROLE_DEFAULT_ROUTES[role] ?? [];

  // DB-configured routes via direct REST fetch (service role — bypasses RLS)
  const dbRoutes = await getDbRoutes(role);

  const allowedRoutes = [...new Set([...defaultRoutes, ...dbRoutes])];

  // Always allow the role's own home route — prevents redirect loops
  const home = ROLE_HOME[role];
  if (home && (pathname === home || pathname.startsWith(home + '/'))) {
    return response;
  }

  const isAllowed = allowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (!isAllowed) {
    return NextResponse.redirect(new URL(home ?? '/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|csv)$).*)'],
};
