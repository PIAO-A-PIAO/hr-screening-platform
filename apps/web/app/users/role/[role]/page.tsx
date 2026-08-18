import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UsersIndexRoute } from "../../../../components/users-index-route";
import type { UserRole } from "../../../../lib/user-api";

const roleLabels: Record<UserRole, { title: string; description: string }> = {
  RECRUITER: {
    title: "Recruiters",
    description: "View all recruiter users as read-only summary cards.",
  },
  CANDIDATE: {
    title: "Candidates",
    description: "View all candidate users as read-only summary cards.",
  },
};

type RolePageProps = {
  params: Promise<{
    role: string;
  }>;
};

export const metadata: Metadata = {
  title: "Users by Role | DS-HR",
  description: "Browse users by role",
};

export default async function UsersByRolePage({ params }: RolePageProps) {
  const resolvedParams = await params;
  const role = resolvedParams.role.toUpperCase() as UserRole;
  const roleLabel = roleLabels[role];

  if (!roleLabel) {
    notFound();
  }

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <div className="eyebrow">DS-HR - Users</div>
        <h1>{roleLabel.title}</h1>
        <p>{roleLabel.description}</p>
        <div className="heroActions">
          <Link className="ghostButton inlineButton" href="/users">
            Back to all users
          </Link>
        </div>
      </section>

      <UsersIndexRoute
        role={role}
        title={roleLabel.title}
        description={roleLabel.description}
      />
    </main>
  );
}
