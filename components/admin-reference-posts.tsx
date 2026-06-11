"use client";

import { useRef, useState } from "react";
import { createReferencePostAction } from "@/app/actions";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import type { Campaign, Persona, ReferencePost, Topic } from "@/lib/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function AdminReferencePosts({
  campaigns,
  personas,
  referencePosts,
  topics
}: {
  campaigns: Campaign[];
  personas: Persona[];
  referencePosts: ReferencePost[];
  topics: Topic[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreateReferencePost(formData: FormData) {
    setError(null);
    setIsSaving(true);

    const result = await createReferencePostAction(formData);
    setIsSaving(false);

    if (result.ok) {
      formRef.current?.reset();
      window.dispatchEvent(
        new CustomEvent("slop-cannon:toast", {
          detail: { message: "Reference post saved" }
        })
      );
      return;
    }

    setError(result.error ?? "Could not save the reference post.");
  }

  return (
    <section className="grid">
      <div className="panel">
        <h2>Add reference post</h2>
        <p className="muted">
          Paste real X or LinkedIn posts here. They become examples and avoid-patterns in generation prompts.
        </p>
        <form ref={formRef} action={handleCreateReferencePost} className="grid two">
          <div className="form-row">
            <label htmlFor="reference-source">Source</label>
            <select id="reference-source" name="source" defaultValue="manual">
              <option value="manual">Manual</option>
              <option value="x">X</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <label htmlFor="reference-channel">Channel</label>
            <select id="reference-channel" name="channel" defaultValue="x">
              <option value="x">X</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <label htmlFor="reference-label">Label</label>
            <select id="reference-label" name="label" defaultValue="good_example">
              <option value="good_example">Good example</option>
              <option value="high_performing">High performing</option>
              <option value="brand_voice">Brand voice</option>
              <option value="avoid_example">Avoid example</option>
              <option value="competitor">Competitor</option>
            </select>
            <label htmlFor="reference-author">Author</label>
            <input id="reference-author" name="author" placeholder="@handle or name" />
            <label htmlFor="reference-url">URL</label>
            <input id="reference-url" name="url" placeholder="https://..." />
          </div>
          <div className="form-row">
            <label htmlFor="reference-persona">Persona</label>
            <select id="reference-persona" name="personaId" defaultValue="">
              <option value="">Any persona</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
            <label htmlFor="reference-topic">Topic</label>
            <select id="reference-topic" name="topicId" defaultValue="">
              <option value="">Any topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            <label htmlFor="reference-campaign">Campaign</label>
            <select id="reference-campaign" name="campaignId" defaultValue="">
              <option value="">Any campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
            <label htmlFor="reference-content">Post content</label>
            <textarea id="reference-content" name="content" placeholder="Paste the real post here" />
            <label htmlFor="reference-notes">Notes</label>
            <textarea id="reference-notes" name="notes" placeholder="What should the system learn from this?" />
            <button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save reference post"}
            </button>
          </div>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
      </div>

      <div className="panel">
        <div className="card-header">
          <div>
            <h2>Reference posts</h2>
            <p className="muted">
              {referencePosts.length} saved example{referencePosts.length === 1 ? "" : "s"} used by the prompt builder.
            </p>
          </div>
        </div>
        <div className="grid">
          {referencePosts.map((post) => {
            const topic = topics.find((item) => item.id === post.topicId);
            const persona = personas.find((item) => item.id === post.personaId);
            const campaign = campaigns.find((item) => item.id === post.campaignId);

            return (
              <article className="card post reference-card" key={post.id}>
                <div className="card-header">
                  <div>
                    <p className="eyebrow">
                      {post.channel.toUpperCase()} · {post.label} · {formatDateTime(post.createdAt)}
                    </p>
                    <h3>{post.author || "Reference post"}</h3>
                  </div>
                  <DeleteConfirmForm
                    message="Are you sure you want to delete this reference post?"
                    target={{ type: "referencePost", id: post.id }}
                  />
                </div>
                <p className="post-content">{post.content}</p>
                {post.notes ? <p className="muted">{post.notes}</p> : null}
                <div className="pill-row">
                  <span className="pill">{post.source}</span>
                  {topic ? <span className="pill">topic: {topic.title}</span> : null}
                  {persona ? <span className="pill">persona: {persona.name}</span> : null}
                  {campaign ? <span className="pill">campaign: {campaign.title}</span> : null}
                  {post.url ? <span className="pill">has source URL</span> : null}
                </div>
              </article>
            );
          })}
          {referencePosts.length === 0 ? <p className="muted">No reference posts yet.</p> : null}
        </div>
      </div>
    </section>
  );
}
