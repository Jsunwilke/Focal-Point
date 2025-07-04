import React, { useState } from "react";
import { Button, Card } from "react-bootstrap";
import { useJobs } from "../../../contexts/JobsContext";
import GroupModal from "./GroupModal";

const GroupsList = ({ groups, jobId }) => {
  const { updateJobGroups } = useJobs();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const handleAddGroup = () => {
    setEditingGroup(null);
    setShowGroupModal(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  };

  const handleDeleteGroup = async (groupId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this group? This action cannot be undone."
      )
    ) {
      return;
    }

    const updatedGroups = groups.filter((group) => group.id !== groupId);
    await updateJobGroups(jobId, updatedGroups);
  };

  if (!groups || groups.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="alert alert-info">
          No group images added for this job yet.
        </div>
        <Button variant="primary" onClick={handleAddGroup}>
          <i className="bi bi-plus-circle"></i> Add First Group
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Group Images ({groups.length})</h5>
        <Button variant="primary" size="sm" onClick={handleAddGroup}>
          <i className="bi bi-plus-circle"></i> Add Group
        </Button>
      </div>

      <div className="row">
        {groups.map((group) => (
          <div key={group.id} className="col-md-6 mb-3">
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <Card.Title className="h6">{group.description}</Card.Title>
                    {group.imageNumbers && (
                      <Card.Text className="mb-1">
                        <strong>Image Numbers:</strong> {group.imageNumbers}
                      </Card.Text>
                    )}
                    {group.notes && (
                      <Card.Text className="text-muted small mb-0">
                        <strong>Notes:</strong> {group.notes}
                      </Card.Text>
                    )}
                  </div>
                  <div className="ms-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-1"
                      onClick={() => handleEditGroup(group)}
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>

      <GroupModal
        show={showGroupModal}
        onHide={() => setShowGroupModal(false)}
        jobId={jobId}
        editingGroup={editingGroup}
        groups={groups}
      />
    </>
  );
};

export default GroupsList;
