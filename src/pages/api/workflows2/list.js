// src/pages/api/workflows2/list.js
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, organizationId } = req.query;

  if (!userId || !organizationId) {
    return res.status(400).json({ error: 'Missing userId or organizationId' });
  }

  try {
    // Get workflows for the organization
    const workflows = await prisma.workflow.findMany({
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
          where: {
            OR: [
              { assignedTo: userId },
              { photographerId: userId },
              { createdBy: userId },
            ],
          },
          include: {
            stage: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        isDefault: 'desc',
      },
    });

    res.status(200).json({ success: true, workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
}