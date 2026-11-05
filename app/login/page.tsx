import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Login } from "@/components/login";
export default async function Page() {
  if (await currentUser()) redirect("/workspace");
  return <Login />;
}
