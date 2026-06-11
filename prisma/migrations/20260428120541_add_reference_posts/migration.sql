-- CreateTable
CREATE TABLE "ReferencePost" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "label" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "content" TEXT NOT NULL,
    "notes" TEXT,
    "personaId" TEXT,
    "topicId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencePost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReferencePost" ADD CONSTRAINT "ReferencePost_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePost" ADD CONSTRAINT "ReferencePost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePost" ADD CONSTRAINT "ReferencePost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
