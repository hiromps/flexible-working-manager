import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { OnboardingForm } from "./onboarding-form";

const getSupabaseAdmin = () =>
  createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

export default async function OnboardingPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/sign-in");
  }

  const supabaseAdmin = getSupabaseAdmin();

  // すでに登録済みかどうか確認
  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (employee) {
    redirect("/attendance");
  }

  const initialName = user.fullName ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "";

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-gray-950 text-center">初期設定</h1>
        <p className="mt-2 text-sm text-gray-600 text-center mb-8">
          アカウントが作成されました。勤怠管理を始めるために、基本情報を入力してください。
          管理者がすでにあなたの情報を登録している場合は、社員コードを入力して連携してください。
        </p>

        <OnboardingForm initialName={initialName} />
      </div>
    </main>
  );
}
