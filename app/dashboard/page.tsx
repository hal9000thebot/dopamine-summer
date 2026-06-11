import { dismissGeneratedPostAction, saveEditedPostAction } from "@/app/actions";
import { CreatePostForm } from "@/components/create-post-form";
import { UserPersonaCard } from "@/components/user-persona-card";
import { requireUser } from "@/lib/auth/guards";
import { getAppData } from "@/lib/data/appData";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function DashboardPage({
  searchParams: _searchParams
}: {
  searchParams?: { user?: string };
}) {
  const authUser = await requireUser();
  const activeUserId = authUser.id;
  const {
    user,
    persona,
    personas,
    topics,
    recommendations,
    recommendedTopicIds,
    generatedPosts,
    selectedPosts
  } = await getAppData(activeUserId);

  const visiblePosts = generatedPosts.filter((post) => post.userId === user.id && post.status !== "rejected");
  const campaignTopics = topics.filter((topic) => topic.title !== "Freeform prompt");

  return (
    <div className="grid two dashboard-layout">
      <section className="grid dashboard-main">
        <div className="panel dashboard-primary">
          <p className="eyebrow">Member dashboard</p>
          <h1>Generate a social post</h1>
          <p className="muted">Signed in as {user.name} · {user.email}</p>

          <div className="section-divider" />
          <p className="eyebrow">Create post</p>
          <h2>Choose how to start</h2>
          <p className="muted">
            Start from your own brief or use a current company topic. Brand context, persona, memory, and
            reference posts still shape the result.
          </p>
          <CreatePostForm
            personas={personas}
            recommendations={recommendations}
            recommendedTopicIds={Array.from(recommendedTopicIds)}
            topics={campaignTopics}
            user={user}
          />
        </div>

        <UserPersonaCard persona={persona} personas={personas} user={user} />

        <div className="panel">
          <h2>Available topics</h2>
          <div className="grid topic-list">
            {campaignTopics.map((topic) => {
              const recommendation = recommendations.find(
                (item) => item.userId === user.id && item.topicId === topic.id
              );

              return (
                <article
                  className={`card ${recommendedTopicIds.has(topic.id) ? "recommendation" : ""}`}
                  key={topic.id}
                >
                  <p className="eyebrow">
                    {recommendedTopicIds.has(topic.id) ? "Recommended" : "Active topic"}
                  </p>
                  <h3>{topic.title}</h3>
                  <p className="muted">{topic.summary}</p>
                  {recommendation ? <p>{recommendation.note}</p> : null}
                  <div className="pill-row">
                    {topic.talkingPoints.map((point) => (
                      <span className="pill" key={point.id}>
                        {point.type}: {point.content}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
            {campaignTopics.length === 0 ? <p className="muted">No active topics yet.</p> : null}
          </div>
        </div>
      </section>

      <aside className="grid dashboard-side">
        <div className="panel">
          <h2>Generated posts</h2>
          <p className="muted">Edit the post before saving/copying. Edited versions become learning data.</p>
          <div className="grid">
            {visiblePosts.map((post) => {
              const savedPost = post.selectedPost;
              const aiWarning = post.memoryCheck?.aiWarning;
              const postEvaluation = post.memoryCheck?.postEvaluation;
              const postPersona = personas.find((item) => item.id === post.personaId);

              return (
                <article className="card post" key={post.id}>
                  <p className="eyebrow">
                    {post.channel.toUpperCase()} · {postPersona?.name ?? "Persona"} · {post.angle}
                  </p>
                  {post.additionalContext ? (
                    <div className="history-block prompt-context">
                      <p className="eyebrow">Additional prompt context</p>
                      <p>{post.additionalContext}</p>
                    </div>
                  ) : null}
                  {post.linkContext && post.linkContext.length > 0 ? (
                    <div className="history-block prompt-context">
                      <p className="eyebrow">Links read for this draft</p>
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
                  {savedPost ? (
                    <>
                      <div className="history-block saved">
                        <p className="eyebrow">
                          Saved {formatDateTime(savedPost.copiedAt)} ·{" "}
                          {savedPost.wasEdited ? "Edited version" : "Saved unchanged"}
                        </p>
                        <p className="post-content">{savedPost.editedContent}</p>
                      </div>
                      <details className="history-block">
                        <summary>Original generated post</summary>
                        <p className="post-content">{post.content}</p>
                        <p className="muted">{post.rationale}</p>
                      </details>
                    </>
                  ) : (
                    <>
                      <p className="post-content">{post.content}</p>
                      <p className="muted">{post.rationale}</p>
                      {postEvaluation ? (
                        <div className="history-block warning">
                          <p className="eyebrow">Post evaluation</p>
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
                            <p className="muted" key={warning}>
                              {warning}
                            </p>
                          ))}
                          {postEvaluation.evaluationWarning ? (
                            <p className="muted">Evaluation fallback: {postEvaluation.evaluationWarning}</p>
                          ) : null}
                        </div>
                      ) : null}
                      <form action={saveEditedPostAction} className="form-row" data-success-message="Successfully saved">
                        <input name="generatedPostId" type="hidden" value={post.id} />
                        <label htmlFor={`edit-${post.id}`}>Edited version</label>
                        <textarea id={`edit-${post.id}`} name="editedContent" defaultValue={post.content} />
                        <button type="submit">Save as copied</button>
                      </form>
                      <form action={dismissGeneratedPostAction} data-success-message="Successfully dismissed">
                        <input name="generatedPostId" type="hidden" value={post.id} />
                        <button className="secondary" type="submit">Dismiss draft</button>
                      </form>
                    </>
                  )}
                </article>
              );
            })}
            {visiblePosts.length === 0 ? <p className="muted">No generated posts yet.</p> : null}
          </div>
        </div>

        <div className="panel">
          <h2>Saved learning data</h2>
          <p className="muted">{selectedPosts.filter((post) => post.userId === user.id).length} edited posts saved.</p>
        </div>
      </aside>
    </div>
  );
}
