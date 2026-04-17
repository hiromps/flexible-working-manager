-- 既存の外部キー制約を削除
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- audit_logs などの他テーブルが user_id を使っている可能性があるためそちらも対応
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

-- id の型を text に変更する (UUID がすでに入っている場合は text にキャスト)
ALTER TABLE public.profiles ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.employees ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.audit_logs ALTER COLUMN actor_user_id TYPE text USING actor_user_id::text;

-- 外部キー制約を再設定 (profiles -> employees)
ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Supabase Auth への依存を解除したため、Clerk 用のポリシーに変更
-- (ここでは RLS を無効化するか、認証基盤に合わせてポリシーを作り直す必要がありますが、
-- ひとまず Clerk バックエンドやサーバーサイドからの操作を許可するために調整します)

-- 一旦全てのポリシーを削除 (あるいは再作成)
DROP POLICY IF EXISTS "users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "employees can view own attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "employees can insert own attendance" ON public.attendance_logs;

-- ※ Clerk 連携時は、Supabase 側に JWT の検証を設定するか、サーバー側 (Server Actions) で
-- Service Role Key を使ってアクセスするため、RLS は一旦バイパスするか Clerk 向けに設定します。
-- ここでは簡易的に、Server Actions 経由でのアクセスを前提として RLS を調整します。
