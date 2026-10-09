import { AdminDashboard } from "../components/admin-dashboard";
import { redirect } from "next/navigation";
import { is_admin_request } from "../lib/admin-auth";

export const metadata = { title: "SindreJS Admin" };

export default async function AdminPage() {
  if (!(await is_admin_request())) redirect("/admin/login");
  return <AdminDashboard />;
}
