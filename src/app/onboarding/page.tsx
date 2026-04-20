import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

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
    .single();

  if (employee) {
    redirect("/attendance");
  }

  const initialName = user.fullName ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "";

  async function submitOnboarding(formData: FormData) {
    "use server";

    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const fullName = String(formData.get("fullName") || "").trim();
    const department = String(formData.get("department") || "").trim() || null;
    const weeklyLegalHours = Number(formData.get("weeklyLegalHours")) || 40;

    if (!fullName) {
      throw new Error("氏名は必須です");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // profileがまだない場合のために念のため作成
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: user?.primaryEmailAddress?.emailAddress ?? "",
        role: "employee",
      },
      { onConflict: "id" }
    );

    const employeeCode = `EMP-${userId.slice(-6).toUpperCase()}`;

    const { error } = await supabaseAdmin.from("employees").insert({
      user_id: userId,
      employee_code: employeeCode,
      full_name: fullName,
      department: department,
      weekly_legal_hours: weeklyLegalHours,
    });

    if (error) {
      throw new Error(`社員情報の登録に失敗しました: ${error.message}`);
    }

    revalidatePath("/attendance");
    redirect("/attendance");
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-gray-950 text-center">初期設定</h1>
        <p className="mt-2 text-sm text-gray-600 text-center mb-8">
          アカウントが作成されました。勤怠管理を始めるために、基本情報を入力してください。
        </p>

        <form action={submitOnboarding} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-sm font-bold text-gray-700">
              氏名 <span className="text-[#e73858]">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              defaultValue={initialName}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
              placeholder="山田 太郎"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="department" className="block text-sm font-bold text-gray-700">
              所属 (任意)
            </label>
            <input
              type="text"
              id="department"
              name="department"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
              placeholder="営業部"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="weeklyLegalHours" className="block text-sm font-bold text-gray-700">
              週法定労働時間
            </label>
            <select
              id="weeklyLegalHours"
              name="weeklyLegalHours"
              defaultValue={40}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
            >
              <option value={40}>40時間 (通常)</option>
              <option value={44}>44時間 (特例措置対象事業場)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#0457a7] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#005a96]"
          >
            登録して始める
          </button>
        </form>
      </div>
    </main>
  );
}
