import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { LogIn } from "lucide-react";

const SYMBOL_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-symbol_6be6c49b.webp';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <img
              src={SYMBOL_LOGO_URL}
              alt="달빛워크"
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-xl font-bold text-foreground">달빛워크</h1>
            <p className="text-sm text-muted-foreground text-center">
              견적서 / 제안서 관리 시스템
            </p>
          </div>

          {/* Login Card */}
          <div className="w-full bg-card border border-border rounded-xl p-8 shadow-sm">
            <div className="flex flex-col items-center gap-5">
              <p className="text-sm text-muted-foreground text-center">
                로그인하여 견적서와 제안서를 관리하세요.
              </p>
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                <LogIn className="w-4 h-4" />
                로그인
              </Button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground">
            DALBIT WORK &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
