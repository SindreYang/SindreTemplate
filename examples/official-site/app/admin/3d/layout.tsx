import { redirect } from "next/navigation";
import { is_admin_request } from "../../lib/admin-auth";

export default async function ThreeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await is_admin_request())) redirect("/admin/login");
  return children;
}
