import {
  createBrandContextAction,
  createCampaignAction,
  createTopicAction,
  recommendTopicAction,
  updateAiSettingsAction,
} from "@/app/actions";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CreatePersonaForm,
  EditableBrandContextCard,
  EditableCampaignCard,
  EditablePersonaCard,
  EditablePromptQualityControlsCard,
  EditableTopicCard
} from "@/components/admin-editables";
import { AdminPostHistoryTabs } from "@/components/admin-post-history-tabs";
import { AdminReferencePosts } from "@/components/admin-reference-posts";
import { AdminTeamManagement } from "@/components/admin-team-management";
import { DeleteConfirmForm } from "@/components/delete-confirm-form";
import { PromptPreview } from "@/components/prompt-preview";
import { requireAdmin } from "@/lib/auth/guards";
import { getAppData } from "@/lib/data/appData";

export const dynamic = "force-dynamic";

const ADMIN_SECTIONS = [
  { id: "ai-settings", label: "AI settings" },
  { id: "prompt-preview", label: "Prompt preview" },
  { id: "prompt-quality", label: "Prompt quality controls" },
  { id: "reference-posts", label: "Reference posts" },
  { id: "team-management", label: "Team management" },
  { id: "personas", label: "Personas" },
  { id: "planning", label: "Campaigns, topics and recommendations" },
  { id: "brand-context", label: "Brand context sections" },
  { id: "team-history", label: "Team history" }
] as const;

type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

function isAdminSection(value: string | undefined): value is AdminSectionId {
  return ADMIN_SECTIONS.some((section) => section.id === value);
}

function AdminSidebar({ activeSection }: { activeSection: AdminSectionId }) {
  return (
    <aside className="admin-sidebar">
      <p className="eyebrow">Admin</p>
      <nav className="admin-menu" aria-label="Admin sections">
        {ADMIN_SECTIONS.map((section) => (
          <Link
            className={activeSection === section.id ? "admin-menu-item active" : "admin-menu-item"}
            href={`/admin?section=${section.id}`}
            key={section.id}
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function SectionHeader({ activeSection }: { activeSection: AdminSectionId }) {
  const label = ADMIN_SECTIONS.find((section) => section.id === activeSection)?.label ?? "Admin";

  return (
    <section className="panel">
      <p className="eyebrow">Admin workspace</p>
      <h1>{label}</h1>
      <p className="muted">
        Manage the context, users, prompts, and learning data that shape generation.
      </p>
    </section>
  );
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { section?: string };
}) {
  const adminUser = await requireAdmin();
  const activeSection = isAdminSection(searchParams?.section) ? searchParams.section : "ai-settings";
  const {
    users,
    personas,
    brandContext,
    campaigns,
    topics,
    recommendations,
    referencePosts,
    generatedPosts,
    selectedPosts,
    aiSettings,
    promptQualityControls,
    aiModelOptions
  } = await getAppData(adminUser.id);

  const planningTopics = topics.filter((topic) => topic.title !== "Freeform prompt");

  const sectionContent = {
    "ai-settings": (
      <section className="panel">
        <h2>AI settings</h2>
        <form action={updateAiSettingsAction} className="grid two" data-success-message="Successfully saved">
          <div className="form-row">
            <label htmlFor="ai-provider">Provider</label>
            <select id="ai-provider" name="provider" defaultValue={aiSettings.provider}>
              <option value="openai">OpenAI</option>
              <option value="mock">Mock</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="ai-model">Model</label>
            <select id="ai-model" name="model" defaultValue={aiSettings.model}>
              {Object.entries(aiModelOptions).flatMap(([provider, models]) =>
                models.map((model) => (
                  <option key={`${provider}-${model}`} value={model}>
                    {provider}: {model}
                  </option>
                ))
              )}
            </select>
            <button type="submit">Save AI settings</button>
          </div>
        </form>
      </section>
    ),

    "prompt-preview": (
      <PromptPreview
        brandContext={brandContext}
        generatedPosts={generatedPosts}
        personas={personas}
        promptQualityControls={promptQualityControls}
        referencePosts={referencePosts}
        topics={planningTopics}
        user={users[0]}
      />
    ),

    "prompt-quality": (
      <section className="panel">
        <EditablePromptQualityControlsCard controls={promptQualityControls} />
      </section>
    ),

    "reference-posts": (
      <AdminReferencePosts
        campaigns={campaigns}
        personas={personas}
        referencePosts={referencePosts}
        topics={planningTopics}
      />
    ),

    "team-management": (
      <AdminTeamManagement
        currentUserId={adminUser.id}
        currentUserRole={adminUser.role}
        personas={personas}
        users={users}
      />
    ),

    "personas": (
      <section className="panel">
        <h2>Personas</h2>
        <CreatePersonaForm />
        <div className="grid">
          {personas.map((persona) => (
            <EditablePersonaCard key={persona.id} persona={persona} />
          ))}
        </div>
      </section>
    ),

    "planning": (
      <div className="grid">
      <section className="grid two admin-split">
        <div className="panel">
          <h2>Campaigns</h2>
          <form action={createCampaignAction} className="form-row" data-success-message="Successfully saved">
            <label htmlFor="campaign-title">Title</label>
            <input id="campaign-title" name="title" placeholder="Campaign name" />
            <label htmlFor="campaign-summary">Summary</label>
            <textarea id="campaign-summary" name="summary" placeholder="What this campaign is about" />
            <button type="submit">Create campaign</button>
          </form>
          <div className="grid">
            {campaigns.map((campaign) => (
              <EditableCampaignCard campaign={campaign} key={campaign.id} />
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Recommendations</h2>
          <form action={recommendTopicAction} className="form-row" data-success-message="Successfully saved">
            <label htmlFor="recommend-user">User</label>
            <select id="recommend-user" name="userId">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <label htmlFor="recommend-topic">Topic</label>
            <select id="recommend-topic" name="topicId">
              {planningTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            <label htmlFor="recommend-note">Note</label>
            <textarea id="recommend-note" name="note" placeholder="Why this topic fits this person" />
            <button type="submit">Suggest topic</button>
          </form>
          <div className="grid">
            {recommendations.map((recommendation) => {
              const user = users.find((item) => item.id === recommendation.userId);
              const topic = planningTopics.find((item) => item.id === recommendation.topicId);
              return (
                <article className="card recommendation" key={recommendation.id}>
                  <div className="card-header">
                    <h3>{topic?.title}</h3>
                    <DeleteConfirmForm
                      message="Are you sure you want to delete this recommendation?"
                      target={{ type: "recommendation", id: recommendation.id }}
                    />
                  </div>
                  <p className="muted">Suggested to {user?.name}</p>
                  <p>{recommendation.note}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid two admin-split">
        <section className="panel create-topic-panel">
          <h2>Create topic</h2>
          <form action={createTopicAction} className="form-row create-topic-form" data-success-message="Successfully saved">
            <label htmlFor="topic-campaign">Campaign</label>
            <select id="topic-campaign" name="campaignId">
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
            <label htmlFor="topic-title">Title</label>
            <input id="topic-title" name="title" placeholder="Topic title" />
            <label htmlFor="topic-summary">Summary</label>
            <textarea id="topic-summary" name="summary" placeholder="Short context for the team" />
            <label htmlFor="topic-audience">Audience</label>
            <input id="topic-audience" name="audience" placeholder="wallet users, builders" />
            <label htmlFor="topic-talking-points">Talking points</label>
            <textarea
              id="topic-talking-points"
              name="talkingPoints"
              placeholder={"One talking point per line\nInclude facts, angles, and avoid-rules"}
            />
            <button type="submit">Create topic</button>
          </form>
        </section>

        <section className="panel">
          <h2>Edit topics</h2>
          <div className="grid">
            {planningTopics.map((topic) => (
              <EditableTopicCard campaigns={campaigns} key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      </section>
      </div>
    ),

    "brand-context": (
      <section className="panel">
        <h2>Brand context sections</h2>
        <form action={createBrandContextAction} className="form-row" data-success-message="Successfully saved">
          <label htmlFor="brand-title">Title</label>
          <input id="brand-title" name="title" placeholder="Product Facts" />
          <label htmlFor="brand-category">Category</label>
          <input id="brand-category" name="category" placeholder="facts" />
          <label htmlFor="brand-content">Content</label>
          <textarea id="brand-content" name="content" placeholder="Context to inject into generation" />
          <button type="submit">Save section</button>
        </form>
        <div className="grid">
          {brandContext.map((section) => (
            <EditableBrandContextCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    ),

    "team-history": (
      <section className="panel">
        <h2>Team history</h2>
        <p className="muted">
          {generatedPosts.length} generated posts · {selectedPosts.length} saved edited posts
        </p>
        <div className="pill-row">
          {Array.from(new Set(generatedPosts.map((post) => post.angle).filter(Boolean))).map((angle) => (
            <span className="pill" key={angle}>
              used angle: {angle}
            </span>
          ))}
        </div>
        <AdminPostHistoryTabs generatedPosts={generatedPosts} personas={personas} topics={topics} users={users} />
      </section>
    )
  } satisfies Record<AdminSectionId, ReactNode>;

  return (
    <div className="admin-layout">
      <AdminSidebar activeSection={activeSection} />
      <div className="admin-content">
        <SectionHeader activeSection={activeSection} />
        {sectionContent[activeSection]}
      </div>
    </div>
  );
}
