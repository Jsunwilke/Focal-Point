import React from "react";
import ReactDOM from "react-dom";
import { X, AlertTriangle, Trash2 } from "lucide-react";

const DeleteConfirmationModal = ({
  show,
  onClose,
  onConfirm,
  title = "Delete Job",
  message = "Are you sure you want to delete this job? This action cannot be undone.",
  confirmText = "Delete Job",
  cancelText = "Cancel",
  isLoading = false,
  jobName = "",
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!show) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002, // Higher than other modals
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          width: "90%",
          maxWidth: "480px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
          animation: "modalSlideIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.5rem 1.5rem 1rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={24} style={{ color: "#dc2626" }} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#111827",
                  lineHeight: "1.5",
                }}
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isLoading}
            style={{
              background: "none",
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              padding: "0.5rem",
              color: "#6b7280",
              borderRadius: "6px",
              transition: "all 0.2s",
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#f3f4f6";
                e.target.style.color = "#374151";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "transparent";
                e.target.style.color = "#6b7280";
              }
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "0 1.5rem 1.5rem",
          }}
        >
          <div style={{ marginLeft: "3.75rem" }}>
            <p
              style={{
                margin: "0 0 1rem 0",
                color: "#6b7280",
                fontSize: "0.95rem",
                lineHeight: "1.6",
              }}
            >
              {message}
            </p>

            {jobName && (
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    color: "#374151",
                  }}
                >
                  <strong>Job:</strong> {jobName}
                </p>
              </div>
            )}

            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: "#dc2626", flexShrink: 0 }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  color: "#991b1b",
                  fontWeight: "500",
                }}
              >
                This action cannot be undone. All job data will be permanently
                deleted.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem 1.5rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            style={{
              padding: "0.625rem 1.25rem",
              backgroundColor: "white",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              color: "#374151",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#f9fafb";
                e.target.style.borderColor = "#9ca3af";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "white";
                e.target.style.borderColor = "#d1d5db";
              }
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: "0.625rem 1.25rem",
              backgroundColor: "#dc2626",
              border: "1px solid #dc2626",
              borderRadius: "8px",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              opacity: isLoading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#b91c1c";
                e.target.style.borderColor = "#b91c1c";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.backgroundColor = "#dc2626";
                e.target.style.borderColor = "#dc2626";
              }
            }}
          >
            {isLoading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid transparent",
                    borderTop: "2px solid currentColor",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default DeleteConfirmationModal;
