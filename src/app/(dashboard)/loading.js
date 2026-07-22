import { Spinner } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      aria-label="Opening page"
    >
      <Spinner size="lg" label="Opening page" />
    </div>
  );
}
