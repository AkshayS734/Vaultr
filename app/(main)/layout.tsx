import { VaultProvider } from "@/app/components/providers/VaultProvider";
import { RouteGuard } from "@/app/components/providers/RouteGuard";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VaultProvider>
      <RouteGuard>
        {children}
      </RouteGuard>
    </VaultProvider>
  );
}
