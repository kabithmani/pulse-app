export default function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 w-5 h-5 rounded-full skeleton shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <div className="h-4 w-14 rounded-full skeleton" />
          </div>
          <div className="h-4 w-3/4 rounded skeleton" />
          <div className="h-3 w-1/3 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}
