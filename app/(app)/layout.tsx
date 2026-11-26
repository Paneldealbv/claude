import { AddDocumentProvider } from "@/components/shell/add-document";
import { MobileHeader, MobileTabbar } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AddDocumentProvider>
      <Sidebar />
      <div className="lg:pl-64">
        <MobileHeader />
        <main className="pb-tabbar mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileTabbar />
    </AddDocumentProvider>
  );
}
