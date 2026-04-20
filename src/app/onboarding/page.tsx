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
    const inputEmployeeCode = String(formData.get("employeeCode") || "").trim();
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

    // 連携先の社員を探す (社員コード または 氏名が入力された場合)
    let existingEmployee = null;
    if (inputEmployeeCode) {
      const { data } = await supabaseAdmin
        .from("employees")
        .select("id, user_id")
        .eq("employee_code", inputEmployeeCode)
        .single();
        
      if (data) {
        if (data.user_id && data.user_id !== userId) {
          throw new Error("入力された社員コードは既に別のアカウントと連携されています。");
        }
        existingEmployee = data;
      }
    } else if (fullName) {
      // 社員コードが入力されなかった場合、氏名で未連携の社員を探す
      const { data } = await supabaseAdmin
        .from("employees")
        .select("id, user_id")
        .eq("full_name", fullName)
        .is("user_id", null)
        .limit(1);
        
      if (data && data.length > 0) {
        existingEmployee = data[0];
      }
    }

    if (existingEmployee) {
      // 既存の社員レコードに紐付け (管理者があらかじめシフト等を作成していた場合)
      const { error } = await supabaseAdmin
        .from("employees")
        .update({
          user_id: userId,
          full_name: fullName,
          ...(department ? { department } : {}),
        })
        .eq("id", existingEmployee.id);
        
      if (error) {
        throw new Error(`社員情報の紐付けに失敗しました: ${error.message}`);
      }
    } else {
      // 新規作成
      const employeeCode = inputEmployeeCode || `EMP-${userId.slice(-6).toUpperCase()}`;

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
          管理者がすでにあなたの情報を登録している場合は、社員コードを入力して連携してください。
        </p>

        <form action={submitOnboarding} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="employeeCode" className="block text-sm font-bold text-gray-700">
              社員コード (管理者が登録済みの場合に入力)
            </label>
            <input
              type="text"
              id="employeeCode"
              name="employeeCode"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-[#0457a7] focus:outline-none focus:ring-1 focus:ring-[#0457a7]"
              placeholder="EMP-12345"
            />
          </div>

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
