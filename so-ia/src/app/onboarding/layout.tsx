import { LogoMark } from "@/components/layout/logo-mark";
import { StepIndicator } from "@/components/onboarding/step-indicator";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen noise-bg flex flex-col">
      <header className="flex items-center gap-2.5 px-6 py-5 lg:px-10">
        <LogoMark spin={false} />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">SO-IA</p>
          <p className="text-[11px] text-muted-foreground">Configuração da organização</p>
        </div>
        <div className="ml-auto">
          <StepIndicator />
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 pb-16 pt-4 lg:px-10">{children}</main>
    </div>
  );
}
