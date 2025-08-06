// src/pages/api/workflows2/create-item.js
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    workflowId, 
    stageId, 
    title, 
    description, 
    type = 'task',
    priority,
    assignedTo,
    createdBy,
    metadata
  } = req.body;

  if (!workflowId || !stageId || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const newItem = await prisma.workflowItem.create({
      data: {
        workflowId,
        stageId,
        title,
        description,
        type,
        priority,
        assignedTo,
        createdBy,
        metadata,
        tags: [],
      },
      include: {
        stage: true,
      },
    });

    res.status(200).json({ success: true, item: newItem });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
}