-- CreateTable
CREATE TABLE "public"."Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowStage" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowItem" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT,
    "status" TEXT,
    "jobId" TEXT,
    "sessionId" TEXT,
    "schoolId" TEXT,
    "photographerId" TEXT,
    "metadata" JSONB,
    "tags" TEXT[],
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "assignedTo" TEXT,

    CONSTRAINT "WorkflowItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workflow_organizationId_idx" ON "public"."Workflow"("organizationId");

-- CreateIndex
CREATE INDEX "Workflow_organizationId_isActive_idx" ON "public"."Workflow"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "WorkflowStage_workflowId_idx" ON "public"."WorkflowStage"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowStage_workflowId_order_idx" ON "public"."WorkflowStage"("workflowId", "order");

-- CreateIndex
CREATE INDEX "WorkflowItem_workflowId_stageId_idx" ON "public"."WorkflowItem"("workflowId", "stageId");

-- CreateIndex
CREATE INDEX "WorkflowItem_workflowId_createdAt_idx" ON "public"."WorkflowItem"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowItem_stageId_idx" ON "public"."WorkflowItem"("stageId");

-- CreateIndex
CREATE INDEX "WorkflowItem_jobId_idx" ON "public"."WorkflowItem"("jobId");

-- CreateIndex
CREATE INDEX "WorkflowItem_sessionId_idx" ON "public"."WorkflowItem"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."WorkflowStage" ADD CONSTRAINT "WorkflowStage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowItem" ADD CONSTRAINT "WorkflowItem_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkflowItem" ADD CONSTRAINT "WorkflowItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "public"."WorkflowStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
