import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware-client';

const ROLE_HOME: Record<string, string> = {
  designer: '/designer',
  smo: '/smo',
  manager: '/manager',
  ceo: '/ceo',
  hr: '/hr',
  admin: '/manager',
};

const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  designer: ['/designer'],
  smo: ['/smo'],
  manager: ['/manager', '/admin', '/content', '/request-task'],
  ceo: ['/ceo', '/manager', '/admin', '/content', '/request-task'],
  hr: ['/hr', '/admin'],
  admin: ['/manager', '/admin', '/content', '/ceo', '/hr', '/designer', '/smo'],
};

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient(request, response);

  const { data: { session } } = await supabase.auth.getSession();
  const pathname = request.nextUrl.pathname;

  if (!session) {
    if (pathname === '/login' || pathname === '/set-password') return response;
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Paths accessible to any authenticated user regardless of role
  if (pathname.startsWith('/set-password') || pathname.startsWith('/request-task')) {
    return response;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role ?? '';

  if (pathname === '/login' || pathname === '/') {
    const dest = ROLE_HOME[role] ?? '/login';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const allowed = ROLE_ALLOWED_PREFIXES[role] ?? [];
  const isAllowed = allowed.some((prefix) => pathname.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
