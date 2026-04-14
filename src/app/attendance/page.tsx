import { createClient } from "@/lib/supabase/server";

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // profile取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800">出勤打刻</h1>
          <div className="text-sm text-gray-600 flex items-center gap-4">
            <span>社員ID: {user?.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-red-600 font-bold hover:underline">ログアウト</button>
            </form>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center space-y-8 py-10">
          <div className="text-5xl font-mono text-gray-800 font-bold tracking-wider">
            {new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-6 rounded-xl transition-colors shadow-sm">
              出勤
            </button>
            <button className="bg-gray-800 hover:bg-gray-900 text-white text-xl font-bold py-6 rounded-xl transition-colors shadow-sm">
              退勤
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-700 mb-4">本日の打刻履歴</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 border border-gray-200">
            まだ打刻履歴がありません
          </div>
        </div>
      </div>
    </div>
  );
}
