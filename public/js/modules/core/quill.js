/**
 * Quill rich text editor management
 */

// Track active Quill editor instances
let activeQuillEditors = {};

/**
 * Initialize a Quill editor
 * @param {string} containerId - ID of the container element (without #)
 * @param {string} placeholder - Placeholder text
 * @returns {Quill} - Quill editor instance
 */
export function initQuillEditor(containerId, placeholder) {
  const editor = new Quill(`#${containerId}`, {
    theme: 'snow',
    placeholder: placeholder || 'Enter details...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['clean']
      ]
    }
  });
  activeQuillEditors[containerId] = editor;
  return editor;
}

/**
 * Destroy all active Quill editors
 * Should be called when closing modals to clean up
 */
export function destroyQuillEditors() {
  activeQuillEditors = {};
}

/**
 * Get HTML content from a Quill editor
 * Returns empty string if the editor only contains an empty paragraph
 * @param {Quill} editor - Quill editor instance
 * @returns {string} - HTML content or empty string
 */
export function quillGetHtml(editor) {
  if (!editor) return '';
  const html = editor.root.innerHTML || '';
  return (html.trim() === '<p><br></p>') ? '' : html;
}

/**
 * Get a Quill editor instance by container ID
 * @param {string} containerId - Container element ID
 * @returns {Quill|undefined} - Quill editor instance or undefined
 */
export function getQuillEditor(containerId) {
  return activeQuillEditors[containerId];
}
