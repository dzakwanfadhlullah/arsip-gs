import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Workspace } from "@/components/workspace";
export default async function Page() {
  if (!(await currentUser())) redirect("/login");
  return <Workspace />;
}
