import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const GUIDE_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "dashboard", label: "User dashboard" },
  { id: "generating", label: "Generating posts" },
  { id: "admin", label: "Admin panel" },
  { id: "tuning", label: "Tuning the system" },
  { id: "learning", label: "How learning works" },
  { id: "testing", label: "Testing workflow" },
  { id: "best-practices", label: "Best practices" }
] as const;

type GuideSectionId = (typeof GUIDE_SECTIONS)[number]["id"];

function isGuideSection(value: string | undefined): value is GuideSectionId {
  return GUIDE_SECTIONS.some((section) => section.id === value);
}

function GuideSidebar({ activeSection }: { activeSection: GuideSectionId }) {
  return (
    <aside className="admin-sidebar">
      <p className="eyebrow">Guide</p>
      <nav className="admin-menu" aria-label="Guide sections">
        {GUIDE_SECTIONS.map((section) => (
          <Link
            className={activeSection === section.id ? "admin-menu-item active" : "admin-menu-item"}
            href={`/guide?section=${section.id}`}
            key={section.id}
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function GuideHeader({ activeSection }: { activeSection: GuideSectionId }) {
  const label = GUIDE_SECTIONS.find((section) => section.id === activeSection)?.label ?? "Guide";

  return (
    <section className="panel guide-hero">
      <p className="eyebrow">The Slop Cannon</p>
      <h1>{label}</h1>
      <p className="muted">
        A practical guide for generating posts, tuning context, and helping the system improve over time.
      </p>
    </section>
  );
}

function GuideArticle({ children }: { children: ReactNode }) {
  return <article className="panel guide-page">{children}</article>;
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="inline-code">{children}</code>;
}

export default async function GuidePage({
  searchParams
}: {
  searchParams?: { section?: string };
}) {
  await requireUser();
  const activeSection = isGuideSection(searchParams?.section) ? searchParams.section : "overview";

  const sectionContent = {
    overview: (
      <GuideArticle>
        <h2>What This App Does</h2>
        <p>
          The Slop Cannon helps the Ambire team create better X and LinkedIn posts from shared company context.
          It gives teammates a structured way to generate drafts, edit them, save the useful ones, and turn
          those saved posts into learning data.
        </p>

        <h3>The App Has Two Main Areas</h3>
        <ul>
          <li>
            <strong>Dashboard:</strong> where team members create posts from either a freeform brief or a current
            topic, add context and links, edit drafts, and save useful output.
          </li>
          <li>
            <strong>Admin:</strong> where admins manage brand context, campaigns, topics, personas, reference
            posts, prompt rules, team roles, and team history.
          </li>
          <li>
            <strong>Changelog:</strong> where everyone can see what changed in each production version.
          </li>
        </ul>

        <h3>Simple Rule</h3>
        <p>
          If output feels generic, improve one of these: the user brief, source links, topic specificity,
          persona choice, brand context, reference posts, or prompt quality controls.
        </p>
      </GuideArticle>
    ),

    dashboard: (
      <GuideArticle>
        <h2>User Dashboard</h2>
        <p>
          The Dashboard is the daily workspace for team members. This is where posts are generated, edited,
          and saved.
        </p>

        <h3>Create A Post</h3>
        <p>
          The main Dashboard action is <strong>Create post</strong>. Start by choosing whether the post should be
          <strong> Freeform</strong> or <strong>From topic</strong>.
        </p>
        <ul>
          <li>
            <strong>Freeform:</strong> use your own brief when the post is not tied to a campaign or existing
            topic. Add links when the post should recap or use external source material.
          </li>
          <li>
            <strong>From topic:</strong> choose an active company topic. The selected topic card shows summary,
            recommendation notes, and talking points before generation.
          </li>
        </ul>

        <h3>Default Persona And Per-Post Persona</h3>
        <p>
          Your default persona controls the usual voice and framing for your account. Click <strong>Edit</strong>
          in the default persona card if you want to change it globally. You can also override the persona inside
          <strong> Create post</strong> for a single generation without changing your default.
        </p>
        <ul>
          <li><strong>Founder:</strong> strategic, opinionated, market-aware, but concrete.</li>
          <li><strong>Technical builder:</strong> precise and practical, with useful implementation detail.</li>
          <li><strong>UX advocate:</strong> focused on clarity, trust, onboarding, and reduced friction.</li>
          <li><strong>Marketer / non-technical:</strong> accessible, benefits-led, and polished.</li>
          <li><strong>Balanced team voice:</strong> balanced voice with no strong technical or UX bias.</li>
        </ul>

        <h3>Available Topics</h3>
        <p>
          The Available topics section is context-only. It lets you scan current priorities and recommendations.
          To generate from a topic, use <strong>Create post</strong> and switch to <strong>From topic</strong>.
        </p>
      </GuideArticle>
    ),

    generating: (
      <GuideArticle>
        <h2>Generating Posts</h2>
        <p>
          Start in <strong>Create post</strong>. Choose Freeform or From topic, select the persona and channel,
          then add the context that should shape the draft.
        </p>

        <h3>Freeform Mode</h3>
        <p>
          Use Freeform when you know what you want to say but it is not part of a campaign. The brief is treated
          as the main subject. The more specific it is, the better the output.
        </p>
        <p>
          Use <strong>Links to read(optional)</strong> when the post should use source material. Paste up to three
          public links. For recap or summary prompts, the fetched link content becomes the primary source, and the
          model is instructed to preserve concrete details instead of writing vague brand commentary.
        </p>

        <h3>Topic Mode</h3>
        <p>
          Use From topic when you want to post about an active company priority. Pick a topic, review the selected
          topic context card, then use <strong>Add to prompt</strong> for a specific angle, personal detail, or
          constraint.
        </p>

        <h3>Good Prompt Examples</h3>
        <div className="guide-example">
          Mention how this helps users avoid signing anxiety.
        </div>
        <div className="guide-example">
          Make this sound like a technical observation from someone building wallets.
        </div>
        <div className="guide-example">
          Recap this article and preserve the specific product updates, talks, and event moments.
        </div>
        <div className="guide-example">
          Use a playful comparison, but keep the post practical.
        </div>

        <h3>Generated Drafts</h3>
        <p>
          The system generates two variants. X posts are formatted with each sentence on a new line. Draft cards
          show additional prompt context, links read or skipped, AI fallback warnings, duplicate-risk warnings,
          and lightweight AI evaluation scores when available.
        </p>

        <h3>Edit Before Saving</h3>
        <p>
          Generated posts are drafts. Edit the post until it sounds like something you would actually publish.
          The edited version is important because it becomes stronger learning data than the raw generated text.
        </p>

        <h3>Save Or Dismiss</h3>
        <p>
          Save posts that are useful. Dismiss drafts that are not worth keeping. Saved posts stay in history;
          dismissed drafts help keep your workspace clean. Unsaved generated drafts are removed when you generate
          again, so the database does not fill with clutter.
        </p>
      </GuideArticle>
    ),

    admin: (
      <GuideArticle>
        <h2>Admin Panel</h2>
        <p>
          The Admin panel controls the context and rules that shape generation. Use the sidebar to move between
          system areas.
        </p>

        <h3>AI Settings</h3>
        <p>
          Controls which provider and model the system uses. Keep this stable while testing so output quality is
          easier to compare.
        </p>

        <h3>Prompt Preview</h3>
        <p>
          Shows the exact structured context sent to the model for a selected topic, persona, and channel. Use it
          when a post comes out weird and you need to debug what the model saw.
        </p>

        <h3>Team Management</h3>
        <p>
          Owners can change roles and delete users. Admins can adjust personas. New Google sign-ins become members.
        </p>

        <h3>Personas</h3>
        <p>
          Admins can create, edit, and delete personas. Personas influence tone and framing, and users can choose
          a default persona or override it for a single post.
        </p>

        <h3>Campaigns, Topics, And Recommendations</h3>
        <p>
          Admins create campaigns, topics, talking points, and recommendations. The Create topic form is stacked
          vertically so fields are easy to read. Recommendations highlight useful topics for specific teammates.
        </p>

        <h3>Reference Posts</h3>
        <p>
          Reference posts are manually pasted examples that guide style and quality. They can be scoped by channel,
          persona, topic, or campaign, and deleted when they are no longer useful.
        </p>

        <h3>Team History</h3>
        <p>
          Review generated posts, saved posts, edits, repeated angles, and quality warnings. Saved posts
          are the strongest signal because they show what the team actually chose.
        </p>

        <h3>Changelog</h3>
        <p>
          The changelog is no longer part of Admin. It lives in the main navigation so everyone can see product
          updates.
        </p>
      </GuideArticle>
    ),

    tuning: (
      <GuideArticle>
        <h2>Tuning The System</h2>
        <p>
          The system gets better when admins maintain high-quality context. Tune one area at a time, then generate
          a few test posts to see what changed.
        </p>

        <h3>Brand Context Sections</h3>
        <p>
          Treat these as the system’s durable company memory. Useful sections include Brand Voice, Product Facts,
          Security Claims, Messaging, Things To Avoid, Current Priorities, and Positioning.
        </p>

        <h3>Prompt Quality Controls</h3>
        <ul>
          <li><strong>Banned phrases:</strong> generic phrases the model should avoid.</li>
          <li><strong>Preferred phrases:</strong> language and framing you want used more often.</li>
          <li><strong>Never claim:</strong> facts, roadmap points, or security claims the model must not invent.</li>
          <li><strong>Channel rules:</strong> separate style rules for X and LinkedIn.</li>
        </ul>

        <h3>Reference Posts</h3>
        <p>
          Paste real posts from Ambire, founders, teammates, competitors, or high-quality Web3 accounts. Label them
          as good examples, avoid examples, brand voice, high performing, or competitor posts. Add notes explaining
          why each example matters.
        </p>

        <h3>Campaigns And Topics</h3>
        <p>
          Campaigns group related priorities. Topics are the actual things users generate posts about. Strong topics
          include a clear summary, audience, talking points, proof, CTA ideas, and avoid rules.
        </p>

        <h3>Source Links</h3>
        <p>
          Source links are fetched at generation time for Freeform posts. They are not stored as permanent reference
          posts. Use reference posts for durable style examples, and source links for one-off article recaps or
          source-specific drafts.
        </p>
      </GuideArticle>
    ),

    learning: (
      <GuideArticle>
        <h2>How Learning Works</h2>
        <p>
          The app does not fine-tune a model yet. It improves through prompt context, memory, reference examples,
          saved post history, and edited posts.
        </p>

        <h3>What The System Reuses</h3>
        <ul>
          <li><strong>Brand context:</strong> durable company memory maintained by admins.</li>
          <li><strong>Personas:</strong> voice and framing rules for each user.</li>
          <li><strong>Topics:</strong> current company priorities and talking points.</li>
          <li><strong>Reference posts:</strong> examples of what good and bad posts look like.</li>
          <li><strong>Source links:</strong> one-off fetched context for freeform generations.</li>
          <li><strong>Saved posts:</strong> posts users chose to keep.</li>
          <li><strong>Edited posts:</strong> the strongest signal because they show how users improved drafts.</li>
          <li><strong>Save behavior:</strong> a saved post is treated as good enough to become learning data.</li>
        </ul>

        <p>
          The more specific the context, the less generic the output. The most useful learning data is a saved,
          edited post.
        </p>
      </GuideArticle>
    ),

    testing: (
      <GuideArticle>
        <h2>Recommended Testing Workflow</h2>
        <ol>
          <li>Each teammate signs in with Google.</li>
          <li>Each teammate chooses the persona closest to their natural voice.</li>
          <li>An admin recommends one or two topics to each person.</li>
          <li>Each person tests both Create post modes: Freeform and From topic.</li>
          <li>Each person tests both X and LinkedIn.</li>
          <li>For article recaps, paste the article link in Freeform mode and ask for a recap.</li>
          <li>Each person edits before saving.</li>
          <li>Admins review saved posts in Team History.</li>
          <li>Admins update brand context, banned phrases, reference posts, topics, and personas.</li>
        </ol>

        <p>
          Repeat this loop until the output starts to feel consistently useful and less generic.
        </p>
      </GuideArticle>
    ),

    "best-practices": (
      <GuideArticle>
        <h2>Best Practices</h2>

        <h3>For Users</h3>
        <ul>
          <li>Use Freeform for one-off ideas, recaps, and source-based posts.</li>
          <li>Use From topic when the post should align with current company priorities.</li>
          <li>Always add personal context when you have it.</li>
          <li>Use per-post persona override when the default persona is too biased for the subject.</li>
          <li>Paste source links when asking the model to recap or use an article.</li>
          <li>Edit generated posts before saving.</li>
          <li>Do not save weak outputs just to clear the screen.</li>
          <li>Treat generated posts as drafts, not finished posts.</li>
        </ul>

        <h3>For Admins</h3>
        <ul>
          <li>Keep topics specific.</li>
          <li>Keep brand context current.</li>
          <li>Add real reference posts often.</li>
          <li>Use <InlineCode>never claim</InlineCode> rules aggressively for security and product claims.</li>
          <li>Use Prompt Preview when output feels wrong or surprisingly generic.</li>
          <li>Review saved posts weekly.</li>
          <li>Delete clutter when needed.</li>
          <li>Tune one thing at a time so you can see what improved output.</li>
        </ul>
      </GuideArticle>
    )
  } satisfies Record<GuideSectionId, ReactNode>;

  return (
    <div className="admin-layout guide-layout">
      <GuideSidebar activeSection={activeSection} />
      <div className="admin-content">
        <GuideHeader activeSection={activeSection} />
        {sectionContent[activeSection]}
      </div>
    </div>
  );
}
