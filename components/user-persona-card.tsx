"use client";

import { useState } from "react";
import { updatePersonaAction } from "@/app/actions";
import type { Persona, User } from "@/lib/types";

function showSavedToast() {
  window.dispatchEvent(
    new CustomEvent("slop-cannon:toast", {
      detail: { message: "Successfully saved" }
    })
  );
}

export function UserPersonaCard({
  persona,
  personas,
  user
}: {
  persona: Persona;
  personas: Persona[];
  user: User;
}) {
  const [isEditing, setIsEditing] = useState(false);

  async function handleSubmit(formData: FormData) {
    await updatePersonaAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <div className="panel compact-persona-panel">
        <div className="card-header">
          <div>
            <p className="eyebrow">Default persona</p>
            <h2>{persona.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </div>
        <p className="muted">{persona.description}</p>
        <div className="pill-row">
          {persona.toneRules.map((rule) => (
            <span className="pill" key={rule}>
              {rule}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="panel compact-persona-panel">
      <form action={handleSubmit} className="form-row">
        <input name="userId" type="hidden" value={user.id} />
        <label htmlFor="personaId">Choose persona</label>
        <select id="personaId" name="personaId" defaultValue={persona.id}>
          {personas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <div className="split-actions">
          <button type="submit">Save persona</button>
          <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
