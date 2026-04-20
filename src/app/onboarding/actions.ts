"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const getSupabaseAdmin = () =>
  createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

export type OnboardingActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function submitOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { status: "error", message: "認証されていません" };
    }

    const fullName = String(formData.get("fullName") || "").trim();
    const inputEmployeeCode = String(formData.get("employeeCode") || "").trim();
    const department = String(formData.get("department") || "").trim() || null;
    const weeklyLegalHours = Number(formData.get("weeklyLegalHours")) || 40;

    if (!fullName) {
      return { status: "error", message: "氏名は必須です" };
    }

    const supabaseAdmin = getSupabaseAdmin();

    // profileがまだない場合のために念のため作成
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        // emailはここでは必須ではないため省略またはAuthから取得。
        // ClerkのWebhookで取得できなかった場合へのフォールバックとして。
        role: "employee",
      },
      { onConflict: "id" }
    );
    
    // エラーが uuid 形式などで発生しているかチェックするため
    if (profileError) {
      console.error("profile upsert error:", profileError);
      return { status: "error", message: `プロフィール作成エラー: ${profileError.message}` };
    }

    // 連携先の社員を探す (社員コード または 氏名が入力された場合)
    let existingEmployee = null;
    if (inputEmployeeCode) {
      const { data } = await supabaseAdmin
        .from("employees")
        .select("id, user_id")
        .eq("employee_code", inputEmployeeCode)
        .maybeSingle();

      if (data) {
        if (data.user_id && data.user_id !== userId) {
          return { status: "error", message: "入力された社員コードは既に別のアカウントと連携されています。" };
        }
        existingEmployee = data;
      } else {
        return { status: "error", message: "入力された社員コードが見つかりません。確認してください。" };
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
      // 既存の社員レコードに紐付け
      const { error } = await supabaseAdmin
        .from("employees")
        .update({
          user_id: userId,
          full_name: fullName,
          ...(department ? { department } : {}),
        })
        .eq("id", existingEmployee.id);

      if (error) {
        console.error("employee link error:", error);
        return { status: "error", message: `社員情報の紐付けに失敗しました: ${error.message}` };
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
        console.error("employee insert error:", error);
        return { status: "error", message: `社員情報の登録に失敗しました: ${error.message}` };
      }
    }

    revalidatePath("/attendance");
  } catch (err: any) {
    console.error("onboarding unexpected error:", err);
    return { status: "error", message: err.message || "予期せぬエラーが発生しました" };
  }

  redirect("/attendance");
}
