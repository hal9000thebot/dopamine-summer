"use client";

import { useMemo, useState, useTransition } from "react";
import { generateFreeformPostsAction, generatePostsAction } from "@/app/actions";
import type { Persona, Topic, TopicRecommendation, User } from "@/lib/types";

type CreateMode = "freeform" | "topic";

export function CreatePostForm({
  personas,
  recommendations,
  recommendedTopicIds,
  topics,
  user
}: {
  personas: Persona[];
  recommendations: TopicRecommendation[];
  recommendedTopicIds: string[];
  topics: Topic[];
  user: User;
}) {
  const [mode, setMode] = useState<CreateMode>("freeform");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === topicId) ?? topics[0],
    [topicId, topics]
  );
  const selectedRecommendation = selectedTopic
    ? recommendations.find((item) => item.userId === user.id && item.topicId === selectedTopic.id)
    : undefined;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (mode === "topic") {
        await generatePostsAction(formData);
      } else {
        await generateFreeformPostsAction(formData);
      }

      window.dispatchEvent(
        new CustomEvent("slop-cannon:toast", {
          detail: { message: "Successfully generated" }
        })
      );
    });
  }

  return (
    <>
      <div className="segmented-control" aria-label="Post creation mode">
        <button
          className={mode === "freeform" ? "segment active" : "segment"}
          type="button"
          onClick={() => setMode("freeform")}
        >
          Freeform
        </button>
        <button
          className={mode === "topic" ? "segment active" : "segment"}
          type="button"
          onClick={() => setMode("topic")}
          disabled={topics.length === 0}
        >
          From topic
        </button>
      </div>

      <form action={handleSubmit} className="form-row">
        <label htmlFor="create-persona">Persona for this post</label>
        <select id="create-persona" name="personaId" defaultValue={user.personaId}>
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.name}
            </option>
          ))}
        </select>

        <label htmlFor="create-channel">Channel</label>
        <select id="create-channel" name="channel" defaultValue="x">
          <option value="x">X single post</option>
          <option value="linkedin">LinkedIn single post</option>
        </select>

        {mode === "topic" ? (
          <>
            <label htmlFor="create-topic">Topic</label>
            <select
              id="create-topic"
              name="topicId"
              value={selectedTopic?.id ?? ""}
              onChange={(event) => setTopicId(event.target.value)}
              required
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {recommendedTopicIds.includes(topic.id) ? "Recommended: " : ""}
                  {topic.title}
                </option>
              ))}
            </select>

            {selectedTopic ? (
              <div className={recommendedTopicIds.includes(selectedTopic.id) ? "topic-context recommendation" : "topic-context"}>
                <p className="eyebrow">
                  {recommendedTopicIds.includes(selectedTopic.id) ? "Recommended topic" : "Selected topic"}
                </p>
                <h3>{selectedTopic.title}</h3>
                <p className="muted">{selectedTopic.summary}</p>
                {selectedRecommendation ? <p>{selectedRecommendation.note}</p> : null}
                <div className="pill-row">
                  {selectedTopic.talkingPoints.map((point) => (
                    <span className="pill" key={point.id}>
                      {point.type}: {point.content}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <label htmlFor="create-additional-context">Add to prompt</label>
            <textarea
              id="create-additional-context"
              name="additionalContext"
              placeholder="Optional extra context, angle, constraint, or detail for this generation"
            />
          </>
        ) : (
          <>
            <label htmlFor="create-freeform-brief">What should this post be about?</label>
            <textarea
              id="create-freeform-brief"
              name="freeformBrief"
              placeholder="The more detail you add, the higher chance for a quality output"
              required
            />

            <label htmlFor="create-source-links">Links to read(optional)</label>
            <textarea
              id="create-source-links"
              name="sourceLinks"
              placeholder="Optional. Paste up to 3 links, one per line."
            />
          </>
        )}

        <button type="submit" disabled={isPending}>
          {isPending ? "Generating..." : "Generate 2 variants"}
        </button>
      </form>

      {isPending ? (
        <div className="modal-backdrop" role="status" aria-live="polite">
          <div className="modal">
            <div className="spinner" aria-hidden="true" />
            <strong>Generating post</strong>
          </div>
        </div>
      ) : null}
    </>
  );
}
