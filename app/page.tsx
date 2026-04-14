import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Smartphone, IdCard, MessageSquare, Hash } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 h-20 flex items-center shadow-sm">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center">
              <img 
                src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/58d5a5b6-fed4-4e95-bc35-c33cceb99a1a/1776146271579-b8993be8/logo.jpg" 
                alt="MINORU勤怠" 
                className="h-10 w-auto object-contain" 
              />
            </Link>
            <nav className="hidden lg:flex items-center gap-8">
              <Link href="#method" className="text-[14px] font-bold text-[#0457a7] hover:opacity-70 transition-opacity">打刻方法</Link>
              <Link href="#pricing" className="text-[14px] font-bold text-[#0457a7] hover:opacity-70 transition-opacity">料金プラン</Link>
              <Link href="#cases" className="text-[14px] font-bold text-[#0457a7] hover:opacity-70 transition-opacity">導入事例</Link>
              <Link href="#seminar" className="text-[14px] font-bold text-[#0457a7] hover:opacity-70 transition-opacity">セミナー</Link>
              <Link href="#contact" className="text-[14px] font-bold text-[#0457a7] hover:opacity-70 transition-opacity">お問い合わせ</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#documents" className="hidden sm:flex border-2 border-[#0457a7] text-[#0457a7] px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors">
              サービス資料
            </Link>
            <Link href="/login" className="bg-[#e73858] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2">
              無料でお試し
              <ExternalLink size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[700px] flex items-center bg-gradient-to-br from-[#0457a7] to-[#e4c057] from-65% to-65.1%">
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center py-20 relative z-10">
          <div className="text-white">
            <div className="mb-6">
              <span className="text-[12px] opacity-80 block mb-2">【MINORU（ミノル）勤怠】無料で使える勤怠管理システム</span>
              <h1 className="text-[40px] lg:text-[50px] font-bold leading-tight mb-8 tracking-tight whitespace-pre-line">
                勤怠管理はこれひとつ。{"\n"}
                驚きのコスパなら{"\n"}
                MINORU勤怠
              </h1>
            </div>

            <div className="mb-12 flex flex-col sm:flex-row gap-6 items-center">
              <img 
                src="https://pquxfbbxflqvtidtlrhl.supabase.co/storage/v1/object/public/hmac-uploads/brand/3beb5b9b-3d2f-40ed-82a2-eafb3a43fe92/assets/f1495936-e5f1-41c4-884e-6e1e99d2af2f.webp" 
                alt="導入社数12万社突破" 
                className="h-24 w-auto drop-shadow-xl" 
              />
              <div className="bg-[#e4c057] text-[#333333] p-4 rounded-full w-40 h-40 flex flex-col items-center justify-center text-center font-bold shadow-2xl animate-[float_4s_ease-in-out_infinite] border-4 border-white">
                <span className="text-lg">¥0</span>
                <span className="text-xs">から使える！</span>
                <div className="w-full h-px bg-[#333333] my-1 opacity-20"></div>
                <span className="text-[10px]">有料でも</span>
                <span className="text-xl">¥100</span>
                <span className="text-[10px]">/月(税抜)~</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/login" className="bg-[#e73858] text-white text-[20px] font-bold px-10 py-5 rounded-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-3">
                無料で試してみる
                <ExternalLink size={24} />
              </Link>
              <Link href="#document" className="bg-white text-[#0457a7] text-[20px] font-bold px-10 py-5 rounded-lg border-2 border-transparent hover:bg-blue-50 transition-all shadow-lg">
                まずは資料請求
              </Link>
            </div>
          </div>

          {/* Hero Visuals */}
          <div className="relative lg:h-[600px] flex items-center justify-center lg:justify-end">
            <div className="relative z-20">
              <div className="bg-white p-2 rounded-2xl shadow-2xl border-4 border-blue-100 transform -rotate-2">
                <img 
                  src="https://pquxfbbxflqvtidtlrhl.supabase.co/storage/v1/object/public/hmac-uploads/brand/3beb5b9b-3d2f-40ed-82a2-eafb3a43fe92/assets/fad2f7d8-52a1-4111-ada1-17db1dd16e18.webp" 
                  alt="UI Dashboard" 
                  className="rounded-xl w-full max-w-[580px] object-cover" 
                />
              </div>
              <div className="absolute -bottom-10 -left-10 bg-white p-2 rounded-xl shadow-2xl border-2 border-gray-100 hidden md:block animate-[float_4s_ease-in-out_infinite] [animation-delay:1s]">
                <img 
                  src="https://pquxfbbxflqvtidtlrhl.supabase.co/storage/v1/object/public/hmac-uploads/brand/3beb5b9b-3d2f-40ed-82a2-eafb3a43fe92/assets/824c9707-315c-4ec9-a6c4-a5d9a33c0807.webp" 
                  alt="UI Payroll" 
                  className="rounded-lg w-64" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Background Element */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-[#005a96] opacity-30 pointer-events-none [clip-path:polygon(100%_0,100%_100%,0%_100%,35%_0%)]"></div>
      </section>

      {/* Value Proposition / Comparison */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 text-center">
          <p className="text-[#0457a7] font-bold text-xl mb-4">勤怠管理システムでお悩みの方へ</p>
          <h2 className="text-[40px] font-bold text-[#333333] tracking-tight mb-16">
            価格で比べてください
          </h2>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Case 1: Small */}
            <div className="bg-blue-50 rounded-3xl p-10 border border-blue-100 flex flex-col justify-between">
              <div>
                <h3 className="text-[24px] font-bold mb-6 text-[#0457a7]">利用人数30名以下なら</h3>
                <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm">
                  <p className="text-gray-500 mb-2 font-bold">他社製品の場合</p>
                  <p className="text-2xl font-bold text-gray-400 line-through mb-4">月額 ¥15,000~</p>
                  <div className="h-px bg-gray-200 w-full mb-6"></div>
                  <p className="text-[#0457a7] font-bold text-sm mb-1">MINORU勤怠なら</p>
                  <p className="text-[48px] font-bold text-[#0457a7] flex items-end justify-center">
                    <span className="text-2xl mb-3">¥</span>0
                  </p>
                </div>
              </div>
              <p className="text-gray-600 text-[16px] leading-relaxed">
                初期費用も月額費用もかかりません。まずは少人数から始めたい企業様に最適です。
              </p>
            </div>

            {/* Case 2: Large */}
            <div className="bg-blue-50 rounded-3xl p-10 border border-blue-100 flex flex-col justify-between">
              <div>
                <h3 className="text-[24px] font-bold mb-6 text-[#0457a7]">利用人数31名以上なら</h3>
                <div className="bg-white rounded-2xl p-8 mb-8 shadow-sm ring-4 ring-[#e4c057]/30">
                  <p className="text-gray-500 mb-2 font-bold">他社製品の場合</p>
                  <p className="text-2xl font-bold text-gray-400 line-through mb-4">月額 ¥400 / 人</p>
                  <div className="h-px bg-gray-200 w-full mb-6"></div>
                  <p className="text-[#0457a7] font-bold text-sm mb-1">MINORU勤怠なら</p>
                  <p className="text-[48px] font-bold text-[#0457a7] flex items-end justify-center">
                    <span className="text-2xl mb-3 leading-none">¥</span>100
                    <span className="text-xl mb-3 ml-1 leading-none">/ 人</span>
                  </p>
                </div>
              </div>
              <p className="text-gray-600 text-[16px] leading-relaxed">
                業界最安クラスの価格設定。多機能ながら1名あたりのコストを大幅に抑えることが可能です。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Icons */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-blue-100 text-[#0457a7] rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone size={32} />
              </div>
              <p className="font-bold">スマホ打刻</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-blue-100 text-[#0457a7] rounded-full flex items-center justify-center mx-auto mb-4">
                <IdCard size={32} />
              </div>
              <p className="font-bold">ICカード対応</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-blue-100 text-[#0457a7] rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={32} />
              </div>
              <p className="font-bold">LINE連携</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-blue-100 text-[#0457a7] rounded-full flex items-center justify-center mx-auto mb-4">
                <Hash size={32} />
              </div>
              <p className="font-bold">Slack打刻</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-[#0457a7] text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[#005a96] opacity-20 skew-y-3 origin-top-left"></div>
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-[32px] font-bold mb-10">まずは無料ではじめてみませんか？</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/login" className="bg-[#e73858] text-white text-[20px] font-bold px-12 py-6 rounded-lg shadow-2xl hover:bg-opacity-90 transition-all">
              無料で試してみる
            </Link>
            <Link href="#document" className="bg-white text-[#0457a7] text-[20px] font-bold px-12 py-6 rounded-lg shadow-2xl hover:bg-gray-100 transition-all">
              資料をダウンロード
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#333333] text-white py-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start border-b border-white/10 pb-12 mb-12 gap-12">
            <div>
              <img 
                src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/58d5a5b6-fed4-4e95-bc35-c33cceb99a1a/1776146271579-b8993be8/logo.jpg" 
                alt="MINORU勤怠" 
                className="h-8 brightness-0 invert mb-6" 
              />
              <p className="text-sm text-gray-400 max-w-sm">
                「MINORU勤怠」は、12万社以上が登録する勤怠管理システムです。豊富な機能が無料からお使いいただけます。
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div>
                <p className="font-bold mb-6">機能</p>
                <ul className="space-y-4 text-sm text-gray-400">
                  <li><Link href="#method" className="hover:text-white">打刻方法</Link></li>
                  <li><Link href="#approval" className="hover:text-white">申請・承認</Link></li>
                  <li><Link href="#shift" className="hover:text-white">シフト管理</Link></li>
                  <li><Link href="#export" className="hover:text-white">データ出力</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-bold mb-6">サポート</p>
                <ul className="space-y-4 text-sm text-gray-400">
                  <li><Link href="#help" className="hover:text-white">ヘルプセンター</Link></li>
                  <li><Link href="#support" className="hover:text-white">導入支援</Link></li>
                  <li><Link href="#seminar" className="hover:text-white">セミナー</Link></li>
                  <li><Link href="#faq" className="hover:text-white">よくある質問</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-bold mb-6">会社情報</p>
                <ul className="space-y-4 text-sm text-gray-400">
                  <li><Link href="#company" className="hover:text-white">運営会社</Link></li>
                  <li><Link href="#terms" className="hover:text-white">利用規約</Link></li>
                  <li><Link href="#privacy" className="hover:text-white">プライバシーポリシー</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-gray-500">© MINORU Attendance Management System Inc. All Rights Reserved.</p>
        </div>
      </footer>

      {/* Define global animation and font via style if not fully configured in tailwind */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}} />
    </div>
  );
}
