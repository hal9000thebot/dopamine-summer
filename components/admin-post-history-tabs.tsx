"use client";

import { useState } from "react";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import type { Persona, StoredGeneratedPost, Topic, User } from "@/lib/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function GeneratedPostCard({
  post,
  personas,
  topics,
  users
}: {
  post: StoredGeneratedPost;
  personas: Persona[];
  topics: Topic[];
  users: User[];
}) {
  const topic = topics.find((item) => item.id === post.topicId);
  const user = users.find((item) => item.id === post.userId);
  const persona = personas.find((item) => item.id === post.personaId);
  const savedPost = post.selectedPost;
  const memoryCheck = post.memoryCheck;
  const aiWarning = memoryCheck?.aiWarning;
  const postEvaluation = memoryCheck?.postEvaluation;

  return (
    <article className="card" key={post.id}>
      <div className="card-header">
        <div>
          <p className="eyebrow">
            {post.channel.toUpperCase()} · {post.status}
          </p>
          <h3>{topic?.title}</h3>
        </div>
        <DeleteConfirmForm
          message="Are you sure you want to delete this post and its saved data?"
          target={{ type: "generatedPost", id: post.id }}
        />
      </div>
      <p className="muted">Generated for {user?.name} · Persona: {persona?.name ?? "Unknown"}</p>
      <div className="pill-row">
        <span className="pill">angle: {post.angle}</span>
        {memoryCheck ? (
          <span className={`pill risk-${memoryCheck.risk}`}>duplicate risk: {memoryCheck.risk}</span>
        ) : null}
      </div>
      <div className="history-block">
        <p className="eyebrow">Generated</p>
        <p className="post-content">{post.content}</p>
      </div>
      {post.linkContext && post.linkContext.length > 0 ? (
        <div className="history-block">
          <p className="eyebrow">Link context</p>
          {post.linkContext.map((link) => (
            <p className="muted" key={link.url}>
              {link.status === "fetched" ? "Read" : "Skipped"}: {link.title ?? link.url}
              {link.status === "failed" && link.error ? ` (${link.error})` : ""}
            </p>
          ))}
        </div>
      ) : null}
      {aiWarning ? (
        <div className="history-block warning">
          <p className="eyebrow">AI fallback warning</p>
          <p>
            <strong>OpenAI failed; mock fallback was used.</strong>
          </p>
          <p className="muted">{aiWarning.reason}</p>
          <p className="muted">
            Attempted: {aiWarning.attemptedProvider} / {aiWarning.attemptedModel}
          </p>
        </div>
      ) : null}
      {memoryCheck && memoryCheck.risk !== "low" ? (
        <div className="history-block warning">
          <p className="eyebrow">Memory warning</p>
          <p>
            Similarity score: <strong>{memoryCheck.similarityScore}</strong>
          </p>
          {memoryCheck.reasons.map((reason) => (
            <p className="muted" key={reason}>{reason}</p>
          ))}
          {memoryCheck.similarToContent ? (
            <p className="post-content">Similar saved post: {memoryCheck.similarToContent}</p>
          ) : null}
        </div>
      ) : null}
      {postEvaluation ? (
        <div className="history-block warning">
          <p className="eyebrow">
            Post evaluation · {postEvaluation.provider} / {postEvaluation.model}
          </p>
          <div className="metric-grid compact">
            <div>
              <p className="eyebrow">Specificity</p>
              <strong>{postEvaluation.specificity}/5</strong>
            </div>
            <div>
              <p className="eyebrow">Brand fit</p>
              <strong>{postEvaluation.brandFit}/5</strong>
            </div>
            <div>
              <p className="eyebrow">Originality</p>
              <strong>{postEvaluation.originality}/5</strong>
            </div>
            <div>
              <p className="eyebrow">Factual risk</p>
              <strong>{postEvaluation.factualRisk}/5</strong>
            </div>
            <div>
              <p className="eyebrow">Repetition risk</p>
              <strong>{postEvaluation.repetitionRisk}/5</strong>
            </div>
          </div>
          {postEvaluation.warnings.map((warning) => (
            <p className="muted" key={warning}>{warning}</p>
          ))}
          {postEvaluation.evaluationWarning ? (
            <p className="muted">Evaluation fallback: {postEvaluation.evaluationWarning}</p>
          ) : null}
        </div>
      ) : null}
      {savedPost ? (
        <div className="history-block saved">
          <p className="eyebrow">
            Saved {formatDateTime(savedPost.copiedAt)} · {savedPost.wasEdited ? "Edited by user" : "Saved unchanged"}
          </p>
          <p className="post-content">{savedPost.editedContent}</p>
        </div>
      ) : null}
    </article>
  );
}

export function AdminPostHistoryTabs({
  generatedPosts,
  personas,
  topics,
  users
}: {
  generatedPosts: StoredGeneratedPost[];
  personas: Persona[];
  topics: Topic[];
  users: User[];
}) {
  const [activeTab, setActiveTab] = useState<"saved" | "generated">("saved");
  const savedPosts = generatedPosts.filter((post) => post.selectedPost || post.status === "copied");
  const draftPosts = generatedPosts.filter((post) => !post.selectedPost && post.status !== "copied");
  const activePosts = activeTab === "saved" ? savedPosts : draftPosts;

  return (
    <>
      <div className="tab-row">
        <button
          className={activeTab === "saved" ? "tab active" : "tab"}
          type="button"
          onClick={() => setActiveTab("saved")}
        >
          Saved posts ({savedPosts.length})
        </button>
        <button
          className={activeTab === "generated" ? "tab active" : "tab"}
          type="button"
          onClick={() => setActiveTab("generated")}
        >
          Generated drafts ({draftPosts.length})
        </button>
      </div>
      <div className="grid">
        {activePosts.map((post) => (
          <GeneratedPostCard key={post.id} personas={personas} post={post} topics={topics} users={users} />
        ))}
        {activePosts.length === 0 ? <p className="muted">No posts in this tab.</p> : null}
      </div>
    </>
  );
}
