// src/pages/api/workflows2/move.js
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { itemId, newStageId } = req.body;

  if (!itemId || !newStageId) {
    return res.status(400).json({ error: 'Missing itemId or newStageId' });
  }

  try {
    const updatedItem = await prisma.workflowItem.update({
      where: { id: itemId },
      data: {
        stageId: newStageId,
        updatedAt: new Date(),
      },
      include: {
        stage: true,
      },
    });

    res.status(200).json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({ error: 'Failed to move item' });
  }
}