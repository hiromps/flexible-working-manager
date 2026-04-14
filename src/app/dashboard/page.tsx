import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // profile取得（管理者ダッシュボード）
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">管理者ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 flex flex-col items-end">
            <span className="font-bold">{user.email}</span>
            <span className="text-xs text-gray-400">権限: {profile?.role || "不明"}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded transition-colors font-bold">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      
      <main className="flex-1 p-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4">管理者向け情報</h2>
          <p className="text-gray-600">ここに管理画面のコンテンツが表示されます。</p>
        </div>
      </main>
    </div>
  );
}
