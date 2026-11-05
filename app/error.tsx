"use client";
import { Button, Empty } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <Empty
        title="Halaman mengalami kendala"
        description="Coba muat ulang. Data yang sudah tersimpan tetap tersedia."
        action={<Button onClick={reset}>Coba kembali</Button>}
      />
    </main>
  );
}
