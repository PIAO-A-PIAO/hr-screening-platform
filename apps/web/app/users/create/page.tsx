import type { Metadata } from "next";
import { UserCreateRoute } from "../../../components/user-create-route";

export const metadata: Metadata = {
  title: "Create User | DS-HR",
  description: "Create a recruiter or candidate user",
};

export default function CreateUserPage() {
  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Users</div>
        <h1>Create user</h1>
        <p>Create a recruiter or candidate record without leaving the browser.</p>
      </section>

      <UserCreateRoute />
    </main>
  );
}
