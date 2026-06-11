import {
  updateTeamUserPersonaAction,
  updateTeamUserRoleAction
} from "@/app/actions";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import type { Persona, User } from "@/lib/types";

export function AdminTeamManagement({
  currentUserId,
  currentUserRole,
  personas,
  users
}: {
  currentUserId: string;
  currentUserRole: string;
  personas: Persona[];
  users: User[];
}) {
  const canManageRoles = currentUserRole === "owner";

  return (
    <section className="panel">
      <h2>Team management</h2>
      <p className="muted">
        New Google sign-ins become members. Owners can change roles and delete users; admins can adjust personas.
      </p>
      <div className="grid">
        {users.map((user) => (
          <article className="card team-row" key={user.id}>
            <div>
              <h3>{user.name}</h3>
              <p className="muted">{user.email}</p>
              {user.id === currentUserId ? <span className="pill">you</span> : null}
              {canManageRoles && user.id !== currentUserId ? (
                <div className="form-row compact-form">
                  <DeleteConfirmForm
                    message="Are you sure you want to delete this user and all of their generated posts, saved posts, and recommendations?"
                    target={{ type: "user", id: user.id }}
                  />
                </div>
              ) : null}
            </div>
            <form action={updateTeamUserPersonaAction} className="form-row compact-form" data-success-message="Successfully saved">
              <input name="userId" type="hidden" value={user.id} />
              <label htmlFor={`team-persona-${user.id}`}>Persona</label>
              <select id={`team-persona-${user.id}`} name="personaId" defaultValue={user.personaId}>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
              <button type="submit">Save persona</button>
            </form>
            <form action={updateTeamUserRoleAction} className="form-row compact-form" data-success-message="Successfully saved">
              <input name="userId" type="hidden" value={user.id} />
              <label htmlFor={`team-role-${user.id}`}>Role</label>
              <select
                disabled={!canManageRoles}
                id={`team-role-${user.id}`}
                name="role"
                defaultValue={user.role}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <button disabled={!canManageRoles} type="submit">Save role</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
