// src/services/workflowDbService.js
import prisma from '../lib/prisma';

class WorkflowDbService {
  // Workflow CRUD operations
  async createWorkflow(data) {
    return await prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        createdBy: data.createdBy,
        stages: {
          create: data.stages?.map((stage, index) => ({
            name: stage.name,
            description: stage.description,
            order: index,
            color: stage.color,
            icon: stage.icon,
            settings: stage.settings,
          })) || [],
        },
      },
      include: {
        stages: true,
        items: true,
      },
    });
  }

  async getWorkflows(organizationId) {
    return await prisma.workflow.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        stages: {
          orderBy: {
            order: 'asc',
          },
        },
        items: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getWorkflowById(id) {
    return await prisma.workflow.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: {
            order: 'asc',
          },
        },
        items: {
          include: {
            stage: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async updateWorkflow(id, data) {
    return await prisma.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        isDefault: data.isDefault,
        updatedAt: new Date(),
      },
      include: {
        stages: true,
        items: true,
      },
    });
  }

  async deleteWorkflow(id) {
    return await prisma.workflow.delete({
      where: { id },
    });
  }

  // Stage operations
  async createStage(workflowId, data) {
    // Get the highest order number
    const maxOrder = await prisma.workflowStage.findFirst({
      where: { workflowId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return await prisma.workflowStage.create({
      data: {
        workflowId,
        name: data.name,
        description: data.description,
        order: (maxOrder?.order ?? -1) + 1,
        color: data.color,
        icon: data.icon,
        settings: data.settings,
      },
    });
  }

  async updateStage(id, data) {
    return await prisma.workflowStage.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        settings: data.settings,
        updatedAt: new Date(),
      },
    });
  }

  async reorderStages(workflowId, stageIds) {
    const updates = stageIds.map((id, index) =>
      prisma.workflowStage.update({
        where: { id },
        data: { order: index },
      })
    );

    return await prisma.$transaction(updates);
  }

  async deleteStage(id) {
    return await prisma.workflowStage.delete({
      where: { id },
    });
  }

  // Item operations
  async createItem(data) {
    return await prisma.workflowItem.create({
      data: {
        workflowId: data.workflowId,
        stageId: data.stageId,
        type: data.type,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        jobId: data.jobId,
        sessionId: data.sessionId,
        schoolId: data.schoolId,
        photographerId: data.photographerId,
        metadata: data.metadata,
        tags: data.tags || [],
        dueDate: data.dueDate,
        createdBy: data.createdBy,
        assignedTo: data.assignedTo,
      },
      include: {
        stage: true,
      },
    });
  }

  async moveItem(itemId, newStageId) {
    return await prisma.workflowItem.update({
      where: { id: itemId },
      data: {
        stageId: newStageId,
        updatedAt: new Date(),
      },
      include: {
        stage: true,
      },
    });
  }

  async updateItem(id, data) {
    return await prisma.workflowItem.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        metadata: data.metadata,
        tags: data.tags,
        dueDate: data.dueDate,
        assignedTo: data.assignedTo,
        completedAt: data.completedAt,
        updatedAt: new Date(),
      },
      include: {
        stage: true,
      },
    });
  }

  async deleteItem(id) {
    return await prisma.workflowItem.delete({
      where: { id },
    });
  }

  // Bulk operations
  async getItemsByWorkflow(workflowId, filters = {}) {
    const where = {
      workflowId,
      ...(filters.stageId && { stageId: filters.stageId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
    };

    return await prisma.workflowItem.findMany({
      where,
      include: {
        stage: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  // Migration helper - convert Firebase workflow to PostgreSQL
  async migrateFromFirebase(firebaseWorkflow, organizationId) {
    try {
      // Check if workflow already exists
      const existing = await prisma.workflow.findFirst({
        where: {
          organizationId,
          name: firebaseWorkflow.name,
        },
      });

      if (existing) {
        console.log(`Workflow "${firebaseWorkflow.name}" already exists, skipping...`);
        return existing;
      }

      // Create the workflow with stages
      const workflow = await this.createWorkflow({
        name: firebaseWorkflow.name,
        description: firebaseWorkflow.description,
        organizationId,
        isActive: firebaseWorkflow.isActive ?? true,
        isDefault: firebaseWorkflow.isDefault ?? false,
        createdBy: firebaseWorkflow.createdBy,
        stages: firebaseWorkflow.stages || [],
      });

      // Migrate items if they exist
      if (firebaseWorkflow.items && firebaseWorkflow.items.length > 0) {
        const stageMap = {};
        workflow.stages.forEach(stage => {
          const originalStage = firebaseWorkflow.stages.find(s => s.name === stage.name);
          if (originalStage?.id) {
            stageMap[originalStage.id] = stage.id;
          }
        });

        for (const item of firebaseWorkflow.items) {
          await this.createItem({
            workflowId: workflow.id,
            stageId: stageMap[item.stageId] || workflow.stages[0].id,
            type: item.type,
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: item.status,
            jobId: item.jobId,
            sessionId: item.sessionId,
            schoolId: item.schoolId,
            photographerId: item.photographerId,
            metadata: item.metadata,
            tags: item.tags,
            dueDate: item.dueDate,
            createdBy: item.createdBy,
            assignedTo: item.assignedTo,
          });
        }
      }

      return workflow;
    } catch (error) {
      console.error('Error migrating workflow:', error);
      throw error;
    }
  }
}

export default new WorkflowDbService();