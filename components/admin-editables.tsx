"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  createPersonaAction,
  createTalkingPointAction,
  updatePersonaDefinitionAction,
  updateBrandContextAction,
  updateCampaignAction,
  updatePromptQualityControlsAction,
  updateTalkingPointAction,
  updateTopicAction
} from "@/app/actions";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import type {
  BrandContextSection,
  Campaign,
  Persona,
  PromptQualityControls,
  TalkingPoint,
  Topic
} from "@/lib/types";

const TALKING_POINT_TYPES = ["angle", "fact", "avoid", "cta", "proof"];

function showSavedToast() {
  window.dispatchEvent(
    new CustomEvent("slop-cannon:toast", {
      detail: { message: "Successfully saved" }
    })
  );
}

function CardHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      <button className="icon-button" type="button" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function EditableCardHeader({
  children,
  deleteButton,
  title
}: {
  children?: ReactNode;
  deleteButton?: ReactNode;
  title: string;
}) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      <div className="split-actions">
        {children}
        {deleteButton}
      </div>
    </div>
  );
}

export function EditableBrandContextCard({ section }: { section: BrandContextSection }) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updateBrandContextAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="card">
        <CardHeader title={section.title} onEdit={() => setIsEditing(true)} />
        <p className="eyebrow">{section.category}</p>
        <p>{section.content}</p>
      </article>
    );
  }

  return (
    <article className="card">
      <form
        action={handleSubmit}
        className="form-row"
      >
        <input name="id" type="hidden" value={section.id} />
        <label htmlFor={`brand-title-${section.id}`}>Title</label>
        <input id={`brand-title-${section.id}`} name="title" defaultValue={section.title} />
        <label htmlFor={`brand-category-${section.id}`}>Category</label>
        <input id={`brand-category-${section.id}`} name="category" defaultValue={section.category} />
        <label htmlFor={`brand-content-${section.id}`}>Content</label>
        <textarea id={`brand-content-${section.id}`} name="content" defaultValue={section.content} />
        <div className="split-actions">
          <button type="submit">Update section</button>
          <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

export function CreatePersonaForm() {
  return (
    <form action={createPersonaAction} className="grid two" data-success-message="Successfully saved">
      <div className="form-row">
        <label htmlFor="persona-name">Name</label>
        <input id="persona-name" name="name" placeholder="Persona name" />
        <label htmlFor="persona-description">Description</label>
        <textarea id="persona-description" name="description" placeholder="How this persona should sound" />
      </div>
      <div className="form-row">
        <label htmlFor="persona-tone-rules">Tone rules</label>
        <textarea id="persona-tone-rules" name="toneRules" placeholder={"One tone rule per line\nSpecific\nPractical"} />
        <label htmlFor="persona-framing-rules">Framing rules</label>
        <textarea id="persona-framing-rules" name="framingRules" placeholder={"One framing rule per line\nUser outcomes"} />
        <button type="submit">Create persona</button>
      </div>
    </form>
  );
}

export function EditablePersonaCard({ persona }: { persona: Persona }) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updatePersonaDefinitionAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="card">
        <EditableCardHeader
          deleteButton={
            <DeleteConfirmForm
              message="Are you sure you want to delete this persona? Users and old generated posts using it will be reassigned to another persona."
              target={{ type: "persona", id: persona.id }}
            />
          }
          title={persona.name}
        >
          <button className="icon-button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </EditableCardHeader>
        <p className="muted">{persona.description}</p>
        <div className="history-block">
          <p className="eyebrow">Tone rules</p>
          <ul className="rule-list">
            {persona.toneRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div className="history-block">
          <p className="eyebrow">Framing rules</p>
          <ul className="rule-list">
            {persona.framingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <form action={handleSubmit} className="grid two">
        <input name="id" type="hidden" value={persona.id} />
        <div className="form-row">
          <label htmlFor={`persona-name-${persona.id}`}>Name</label>
          <input id={`persona-name-${persona.id}`} name="name" defaultValue={persona.name} />
          <label htmlFor={`persona-description-${persona.id}`}>Description</label>
          <textarea id={`persona-description-${persona.id}`} name="description" defaultValue={persona.description} />
        </div>
        <div className="form-row">
          <label htmlFor={`persona-tone-rules-${persona.id}`}>Tone rules</label>
          <textarea id={`persona-tone-rules-${persona.id}`} name="toneRules" defaultValue={persona.toneRules.join("\n")} />
          <label htmlFor={`persona-framing-rules-${persona.id}`}>Framing rules</label>
          <textarea
            id={`persona-framing-rules-${persona.id}`}
            name="framingRules"
            defaultValue={persona.framingRules.join("\n")}
          />
          <div className="split-actions">
            <button type="submit">Update persona</button>
            <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}

export function EditableCampaignCard({ campaign }: { campaign: Campaign }) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updateCampaignAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="card">
        <EditableCardHeader
          deleteButton={
            <DeleteConfirmForm
              message="Are you sure you want to delete this campaign? Topics will remain, but they will no longer belong to this campaign."
              target={{ type: "campaign", id: campaign.id }}
            />
          }
          title={campaign.title}
        >
          <button className="icon-button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </EditableCardHeader>
        <p className="muted">{campaign.summary}</p>
        <span className="pill">{campaign.topicIds.length} topics</span>
      </article>
    );
  }

  return (
    <article className="card">
      <form action={handleSubmit} className="form-row">
        <input name="id" type="hidden" value={campaign.id} />
        <label htmlFor={`campaign-title-${campaign.id}`}>Title</label>
        <input id={`campaign-title-${campaign.id}`} name="title" defaultValue={campaign.title} />
        <label htmlFor={`campaign-summary-${campaign.id}`}>Summary</label>
        <textarea id={`campaign-summary-${campaign.id}`} name="summary" defaultValue={campaign.summary} />
        <div className="split-actions">
          <button type="submit">Update campaign</button>
          <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="history-block">
      <p className="eyebrow">{title}</p>
      {items.length > 0 ? (
        <ul className="rule-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No rules set.</p>
      )}
    </div>
  );
}

export function EditablePromptQualityControlsCard({
  controls
}: {
  controls: PromptQualityControls;
}) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updatePromptQualityControlsAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="card">
        <CardHeader title="Prompt quality controls" onEdit={() => setIsEditing(true)} />
        <p className="muted">
          These rules are injected into every generation prompt and the admin prompt preview.
        </p>
        <div className="grid two">
          <RuleList title="Banned phrases" items={controls.bannedPhrases} />
          <RuleList title="Preferred phrases" items={controls.preferredPhrases} />
          <RuleList title="Never claim" items={controls.neverClaim} />
          <RuleList title="X style rules" items={controls.channelStyleRules.x} />
          <RuleList title="LinkedIn style rules" items={controls.channelStyleRules.linkedin} />
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <form action={handleSubmit} className="grid two">
        <div className="form-row">
          <label htmlFor="banned-phrases">Banned phrases</label>
          <textarea
            id="banned-phrases"
            name="bannedPhrases"
            defaultValue={controls.bannedPhrases.join("\n")}
          />
          <label htmlFor="preferred-phrases">Preferred phrases</label>
          <textarea
            id="preferred-phrases"
            name="preferredPhrases"
            defaultValue={controls.preferredPhrases.join("\n")}
          />
          <label htmlFor="never-claim">Never claim facts/security rules</label>
          <textarea id="never-claim" name="neverClaim" defaultValue={controls.neverClaim.join("\n")} />
        </div>
        <div className="form-row">
          <label htmlFor="x-style-rules">X style rules</label>
          <textarea
            id="x-style-rules"
            name="xStyleRules"
            defaultValue={controls.channelStyleRules.x.join("\n")}
          />
          <label htmlFor="linkedin-style-rules">LinkedIn style rules</label>
          <textarea
            id="linkedin-style-rules"
            name="linkedinStyleRules"
            defaultValue={controls.channelStyleRules.linkedin.join("\n")}
          />
          <div className="split-actions">
            <button type="submit">Update prompt rules</button>
            <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}

export function EditableTopicCard({
  topic,
  campaigns
}: {
  topic: Topic;
  campaigns: Campaign[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updateTopicAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="card">
        <EditableCardHeader
          deleteButton={
            <DeleteConfirmForm
              message="Are you sure you want to delete this topic? This also deletes its generated posts, saved posts, recommendations, and talking points."
              target={{ type: "topic", id: topic.id }}
            />
          }
          title={topic.title}
        >
          <button className="icon-button" type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </EditableCardHeader>
        <p className="muted">{topic.summary}</p>
        <div className="pill-row">
          {topic.audience.map((audience) => (
            <span className="pill" key={audience}>
              {audience}
            </span>
          ))}
        </div>
        <div className="history-block">
          <p className="eyebrow">Talking points</p>
          <div className="grid">
            {topic.talkingPoints.map((point) => (
              <EditableTalkingPointCard key={point.id} point={point} />
            ))}
          </div>
          <AddTalkingPointForm topicId={topic.id} />
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <form action={handleSubmit} className="form-row">
        <input name="id" type="hidden" value={topic.id} />
        <label htmlFor={`topic-campaign-${topic.id}`}>Campaign</label>
        <select id={`topic-campaign-${topic.id}`} name="campaignId" defaultValue={topic.campaignId}>
          <option value="">No campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.title}
            </option>
          ))}
        </select>
        <label htmlFor={`topic-title-${topic.id}`}>Title</label>
        <input id={`topic-title-${topic.id}`} name="title" defaultValue={topic.title} />
        <label htmlFor={`topic-summary-${topic.id}`}>Summary</label>
        <textarea id={`topic-summary-${topic.id}`} name="summary" defaultValue={topic.summary} />
        <label htmlFor={`topic-audience-${topic.id}`}>Audience</label>
        <input id={`topic-audience-${topic.id}`} name="audience" defaultValue={topic.audience.join(", ")} />
        <div className="split-actions">
          <button type="submit">Update topic</button>
          <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

function EditableTalkingPointCard({ point }: { point: TalkingPoint }) {
  const [isEditing, setIsEditing] = useState(false);
  async function handleSubmit(formData: FormData) {
    await updateTalkingPointAction(formData);
    setIsEditing(false);
    showSavedToast();
  }

  if (!isEditing) {
    return (
      <article className="mini-card">
        <div className="card-header">
          <span className="pill">{point.type}</span>
          <div className="split-actions">
            <button className="icon-button" type="button" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <DeleteConfirmForm
              message="Are you sure you want to delete this talking point?"
              target={{ type: "talkingPoint", id: point.id }}
            />
          </div>
        </div>
        <p>{point.content}</p>
        <p className="muted">Importance: {point.importance ?? 0}</p>
      </article>
    );
  }

  return (
    <article className="mini-card">
      <form action={handleSubmit} className="form-row">
        <input name="id" type="hidden" value={point.id} />
        <label htmlFor={`point-type-${point.id}`}>Type</label>
        <select id={`point-type-${point.id}`} name="type" defaultValue={point.type}>
          {TALKING_POINT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label htmlFor={`point-content-${point.id}`}>Content</label>
        <textarea id={`point-content-${point.id}`} name="content" defaultValue={point.content} />
        <label htmlFor={`point-importance-${point.id}`}>Importance</label>
        <input
          id={`point-importance-${point.id}`}
          name="importance"
          type="number"
          defaultValue={point.importance ?? 0}
        />
        <div className="split-actions">
          <button type="submit">Update point</button>
          <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

function AddTalkingPointForm({ topicId }: { topicId: string }) {
  return (
    <form action={createTalkingPointAction} className="mini-card form-row" data-success-message="Successfully saved">
      <input name="topicId" type="hidden" value={topicId} />
      <p className="eyebrow">Add talking point</p>
      <label htmlFor={`new-point-type-${topicId}`}>Type</label>
      <select id={`new-point-type-${topicId}`} name="type" defaultValue="fact">
        {TALKING_POINT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <label htmlFor={`new-point-content-${topicId}`}>Content</label>
      <textarea id={`new-point-content-${topicId}`} name="content" placeholder="New talking point" />
      <label htmlFor={`new-point-importance-${topicId}`}>Importance</label>
      <input id={`new-point-importance-${topicId}`} name="importance" type="number" defaultValue="5" />
      <button type="submit">Add point</button>
    </form>
  );
}
