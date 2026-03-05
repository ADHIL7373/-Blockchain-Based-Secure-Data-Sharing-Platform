import { useState, useRef } from 'react';
import { formatFileSize } from '../utils/chunkFile.js';

/**
 * FileUploader Component
 * Handles file selection for transfer
 */
export function FileUploader({ onFileSelected, disabled }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  /**
   * Handle file selection
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  /**
   * Process selected file
   */
  const processFile = (selectedFile) => {
    // Validate file size (max 1GB)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (selectedFile.size > maxSize) {
      alert('File too large. Maximum size is 1GB.');
      return;
    }

    setFile(selectedFile);
    onFileSelected?.(selectedFile);
  };

  /**
   * Handle drag events
   */
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  /**
   * Handle drop
   */
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  /**
   * Clear file selection
   */
  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelected?.(null);
  };

  return (
    <div className="card p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-xl">📁</span>
        Select File to Send
      </h2>

      {file ? (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="text-4xl">📄</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 break-all text-lg">{file.name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Size: <span className="font-semibold text-blue-700">{formatFileSize(file.size)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">Ready to send ✓</p>
              </div>
            </div>
          </div>

          <button
            onClick={clearFile}
            disabled={disabled}
            className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
          >
            ✕ Clear Selection
          </button>
        </div>
      ) : (
        <>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all transform ${
              dragActive
                ? 'border-blue-500 bg-blue-50 scale-105'
                : 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 hover:border-blue-400 hover:from-blue-50'
            }`}
          >
            <p className="text-5xl mb-4 drop-shadow">📤</p>
            <p className="font-bold text-gray-800 text-lg">Drag files here to send</p>
            <p className="text-sm text-gray-600 mt-2">or click the button below</p>
            <p className="text-xs text-gray-500 mt-3 bg-white bg-opacity-60 inline-block px-3 py-1 rounded-full">
              Maximum size: 1GB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-full mt-4 btn-primary rounded-xl py-3 font-semibold text-lg"
          >
            📂 Browse Files
          </button>
        </>
      )}
    </div>
  );
}
