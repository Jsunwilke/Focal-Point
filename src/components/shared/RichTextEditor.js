// src/components/shared/RichTextEditor.js
import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './RichTextEditor.css';

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Enter description...',
  disabled = false,
  minHeight = '150px',
  readOnly = false
}) => {
  // Quill modules configuration
  const modules = useMemo(() => ({
    toolbar: readOnly ? false : [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['blockquote', 'code-block'],
      ['link'],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
    clipboard: {
      matchVisual: false
    }
  }), [readOnly]);

  // Quill formats
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'blockquote', 'code-block',
    'link',
    'color', 'background'
  ];

  return (
    <div className={`rich-text-editor ${readOnly ? 'rich-text-editor--readonly' : ''} ${disabled ? 'rich-text-editor--disabled' : ''}`}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly || disabled}
        style={{ minHeight }}
      />
    </div>
  );
};

export default RichTextEditor;
