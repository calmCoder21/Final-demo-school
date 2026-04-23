import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // "next" can be passed in sign-in options to redirect to a specific page
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    // Swap the temporary code for a real session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 🔥 Check if profile exists (your fallback logic)
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          await supabase.from("profiles").insert({
            id: user.id,
            role: "guardian",
            full_name: user.user_metadata?.full_name || "Unknown",
          });
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // Role-based redirect
        if (profile.role === "admin") return NextResponse.redirect(`${origin}/admin`);
        if (profile.role === "finance") return NextResponse.redirect(`${origin}/finance`);
        
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If something fails, send back to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
