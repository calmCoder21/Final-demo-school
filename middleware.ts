import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Get user session
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = req.nextUrl.pathname;

  // 🔒 PROTECTED ROUTES
  const isAdminRoute = pathname.startsWith("/admin");
  const isFinanceRoute = pathname.startsWith("/finance");
  const isDashboardRoute = pathname.startsWith("/dashboard");

  if (!user) {
    if (isAdminRoute || isFinanceRoute || isDashboardRoute) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // 🔥 Get role from DB
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // 🔒 ROLE CHECKS
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isFinanceRoute && role !== "finance") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isDashboardRoute && !["guardian", "admin", "finance"].includes(role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (EXCLUDE this so server route works)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
};
