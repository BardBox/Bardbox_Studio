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
  developer: '/manager',
};

// Always accessible to any authenticated user regardless of role
const ALWAYS_ALLOWED = ['/profile', '/request-task', '/set-password'];

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

  // Fetch dynamic route permissions from DB (admin-controlled)
  let allowedRoutes: string[] = [];
  try {
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('route')
      .eq('role', role)
      .eq('enabled', true);
    allowedRoutes = perms?.map((p: { route: string }) => p.route) ?? [];
  } catch {
    // ignore
  }

  // Fall back to hardcoded defaults if table not seeded yet
  if (allowedRoutes.length === 0) {
    allowedRoutes = ROLE_DEFAULT_ROUTES[role] ?? [];
  }

  const isAllowed = allowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (!isAllowed) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|csv)$).*)'],
};
