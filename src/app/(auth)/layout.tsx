export default function AuthLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">n</span>
            </div>
            <span className="text-xl font-bold text-slate-900">neo-geo</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
