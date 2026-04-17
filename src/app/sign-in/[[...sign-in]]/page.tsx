import { SignIn } from "@clerk/nextjs";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const defaultRedirect = redirect_url || "/attendance";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <SignIn fallbackRedirectUrl={defaultRedirect} signUpFallbackRedirectUrl={defaultRedirect} />
    </div>
  );
}