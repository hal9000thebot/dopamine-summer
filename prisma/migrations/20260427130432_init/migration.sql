-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'INVITED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GeneratedPostStatus" AS ENUM ('GENERATED', 'SELECTED', 'COPIED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "personaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "toneRules" JSONB NOT NULL,
    "vocabularyRules" JSONB,
    "framingRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "audience" TEXT[],
    "channels" "Channel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalkingPoint" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalkingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandContextSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandContextSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "variantIndex" INTEGER NOT NULL,
    "inputConfig" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "similarityScore" DECIMAL(65,30),
    "duplicateOfPostId" TEXT,
    "status" "GeneratedPostStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectedPost" (
    "id" TEXT NOT NULL,
    "generatedPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "editedContent" TEXT NOT NULL,
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    "intendedChannel" "Channel" NOT NULL,
    "copiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFeedback" (
    "id" TEXT NOT NULL,
    "generatedPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalityScore" INTEGER NOT NULL,
    "accuracyScore" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_name_key" ON "Persona"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BrandContextSection_title_key" ON "BrandContextSection"("title");

-- CreateIndex
CREATE UNIQUE INDEX "SelectedPost_generatedPostId_key" ON "SelectedPost"("generatedPostId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicRecommendation_userId_topicId_key" ON "TopicRecommendation"("userId", "topicId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalkingPoint" ADD CONSTRAINT "TalkingPoint_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedPost" ADD CONSTRAINT "SelectedPost_generatedPostId_fkey" FOREIGN KEY ("generatedPostId") REFERENCES "GeneratedPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedPost" ADD CONSTRAINT "SelectedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedPost" ADD CONSTRAINT "SelectedPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_generatedPostId_fkey" FOREIGN KEY ("generatedPostId") REFERENCES "GeneratedPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicRecommendation" ADD CONSTRAINT "TopicRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicRecommendation" ADD CONSTRAINT "TopicRecommendation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
