import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 認証を要求しないルート
const isPublicRoute = createRouteMatcher(["/login(.*)", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Next.jsの内部ファイルや静的ファイルを除外
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 常にAPIルートやtrpcルートはマッチさせる
    '/(api|trpc)(.*)',
  ],
};