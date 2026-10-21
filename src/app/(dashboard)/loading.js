export default function DashboardLoading() {
  return (
    <div className="page" role="status" aria-label="Opening page">
      <div className="skeleton h-3 w-32" />
      <div className="skeleton mt-4 h-9 w-72" />
      <div className="mt-12 space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="skeleton h-10 w-full" style={{ opacity: 1 - row * 0.15 }} />
        ))}
      </div>
    </div>
  );
}
