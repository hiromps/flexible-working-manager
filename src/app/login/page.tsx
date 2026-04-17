import Link from "next/link";
import { UserCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-6">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-10 shadow-lg border border-gray-100">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-3">
            MINORU勤怠 ログイン
          </h1>
          <p className="text-gray-500 font-medium">
            あなたの役割を選択してログインしてください
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 社員用ログインボタン */}
          <Link 
            href="/sign-in?redirect_url=/attendance"
            className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
          >
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UserCircle size={40} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">社員としてログイン</h2>
            <p className="text-sm text-gray-500 text-center">
              出勤・退勤の打刻や<br />シフトの確認はこちら
            </p>
          </Link>

          {/* 管理者用ログインボタン */}
          <Link 
            href="/sign-in?redirect_url=/dashboard"
            className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">管理者としてログイン</h2>
            <p className="text-sm text-gray-500 text-center">
              従業員の管理や<br />勤怠データのエクスポートなど
            </p>
          </Link>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            まだアカウントをお持ちでないですか？
            <Link href="/sign-up?redirect_url=/attendance" className="text-blue-600 font-bold hover:underline ml-2">
              無料で新規登録
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}