import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { useJobs } from "../../../contexts/JobsContext";
import { generateUniqueId } from "../../../utils/calculations";

const GroupModal = ({ show, onHide, jobId, editingGroup, groups }) => {
  const { updateJobGroups } = useJobs();
  const [formData, setFormData] = useState({
    id: "",
    description: "",
    imageNumbers: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      if (editingGroup) {
        setFormData(editingGroup);
      } else {
        setFormData({
          id: "",
          description: "",
          imageNumbers: "",
          notes: "",
        });
      }
    }
  }, [show, editingGroup]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      alert("Please enter a description for the group");
      return;
    }

    setLoading(true);

    try {
      const groupData = {
        ...formData,
        id: formData.id || generateUniqueId(),
        description: formData.description.trim(),
        imageNumbers: formData.imageNumbers.trim(),
        notes: formData.notes.trim(),
      };

      let updatedGroups;
      if (editingGroup) {
        // Update existing group
        updatedGroups = groups.map((group) =>
          group.id === editingGroup.id ? groupData : group
        );
      } else {
        // Add new group
        updatedGroups = [...groups, groupData];
      }

      await updateJobGroups(jobId, updatedGroups);
      onHide();
    } catch (error) {
      console.error("Error saving group:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{editingGroup ? "Edit Group" : "Add Group"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Description *</Form.Label>
            <Form.Control
              type="text"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Image Numbers</Form.Label>
            <Form.Control
              type="text"
              name="imageNumbers"
              value={formData.imageNumbers}
              onChange={handleInputChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading && (
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
            ></span>
          )}
          {editingGroup ? "Update" : "Add"} Group
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GroupModal;
