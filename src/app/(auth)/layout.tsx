export default function AuthLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img
            src="/mentio-logo.jpg"
            alt="Mentio — AI-Powered Brand Visibility Ranking"
            className="w-[520px] max-w-full h-auto object-contain"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
