/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useState, useRef } from 'react';
import { toast } from 'sonner';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

interface UseFileOperationsProps {
  onSuccess?: () => void;
}

interface ChunkedUploadState {
  uploadId: string | null;
  currentChunk: number;
  totalChunks: number;
  progress: number;
  isPaused: boolean;
  isUploading: boolean;
}

export const useFileOperations = ({ onSuccess }: UseFileOperationsProps = {}) => {
  const [chunkedUploadState, setChunkedUploadState] = useState<ChunkedUploadState>({
    uploadId: null,
    currentChunk: 0,
    totalChunks: 0,
    progress: 0,
    isPaused: false,
    isUploading: false,
  });

  const uploadStateRef = useRef(chunkedUploadState);
  uploadStateRef.current = chunkedUploadState;

  const refreshFiles = useCallback(() => {
    if (onSuccess) onSuccess();
    window.dispatchEvent(new CustomEvent('filesChanged'));
  }, [onSuccess]);

  // ===== File actions =====
  const starFile = useCallback(async (fileId: string, isStarred: boolean) => {
    try {
      const res = await fetch(`/api/file/starred/${fileId}`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        toast.success(isStarred ? 'Removed from favorites' : 'Marked as favorite');
        refreshFiles();
        return true;
      }
      toast.error('Failed to update favorite status');
      return false;
    } catch {
      toast.error('An error occurred while updating favorite status');
      return false;
    }
  }, [refreshFiles]);

  const trashFile = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/file/trash/${fileId}`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        toast.success('File moved to trash');
        refreshFiles();
        return true;
      }
      toast.error('Failed to move file to trash');
      return false;
    } catch {
      toast.error('An error occurred while moving file to trash');
      return false;
    }
  }, [refreshFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/file/delete/${fileId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('File deleted permanently');
        refreshFiles();
        return true;
      }
      toast.error('Failed to delete file');
      return false;
    } catch {
      toast.error('An error occurred while deleting the file');
      return false;
    }
  }, [refreshFiles]);

  const restoreFile = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/file/restore/${fileId}`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        toast.success('File restored from trash');
        refreshFiles();
        return true;
      }
      toast.error('Failed to restore file');
      return false;
    } catch {
      toast.error('An error occurred while restoring the file');
      return false;
    }
  }, [refreshFiles]);

  const shareFile = useCallback(async (fileId: string, email: string) => {
    try {
      const res = await fetch(`/api/file/shared/${fileId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('File shared successfully');
        refreshFiles();
        return { success: true };
      }
      toast.error(data.message || 'Failed to share file');
      return { success: false, error: data.message };
    } catch {
      toast.error('An error occurred while sharing the file');
      return { success: false, error: 'Network error' };
    }
  }, [refreshFiles]);

  const removeSharedFile = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/file/shared/${fileId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('File removed from shared');
        refreshFiles();
        return true;
      }
      toast.error('Failed to remove file from shared');
      return false;
    } catch {
      toast.error('An error occurred while removing file from shared');
      return false;
    }
  }, [refreshFiles]);

  // ===== Simple upload (backward compatibility) =====
  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/file/upload`, { method: 'POST', body: formData, credentials: 'include' });
      if (res.ok) {
        toast.success('Upload successful');
        refreshFiles();
        return true;
      }
      toast.error('Upload failed');
      return false;
    } catch {
      toast.error('Upload failed');
      return false;
    }
  }, [refreshFiles]);

  // ===== Chunked upload helpers =====
  const initiateChunkedUpload = useCallback(async (fileName: string, fileSize: number, totalChunks: number, contentType: string) => {
    const res = await fetch('/api/file/initiate-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileSize, totalChunks, contentType }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to initiate upload');
    return await res.json(); // { uploadId, key }
  }, []);

  const getUploadUrl = useCallback(async (uploadId: string, chunkIndex: number) => {
    const res = await fetch('/api/file/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, chunkIndex }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    return await res.json(); // { url, partNumber }
  }, []);

  const uploadChunkToS3 = useCallback(async (chunk: Blob, uploadUrl: string) => {
    const res = await fetch(uploadUrl, { method: 'PUT', body: chunk });
    if (!res.ok) throw new Error('Failed to upload chunk to S3');
    const etag = res.headers.get('ETag')?.replace(/"/g, '') || '';
    return etag;
  }, []);

  const markChunkUploaded = useCallback(async (uploadId: string, chunkIndex: number, etag: string) => {
    const res = await fetch('/api/file/mark-chunk-uploaded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, chunkIndex, etag }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to mark chunk uploaded');
  }, []);

  const completeChunkedUpload = useCallback(async (uploadId: string, fileName: string) => {
    const res = await fetch('/api/file/complete-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, fileName }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to complete upload');
    const data = await res.json();
    toast.success('File uploaded successfully');
    refreshFiles();
    return data;
  }, [refreshFiles]);

  const cancelChunkedUpload = useCallback(async (uploadId: string) => {
    if (!uploadId) return;
    try {
      await fetch('/api/file/cancel-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  }, []);

  // ===== Main chunked upload =====
  const uploadFileChunked = useCallback(async (file: File) => {
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      setChunkedUploadState({
        uploadId: null,
        isUploading: true,
        totalChunks,
        currentChunk: 0,
        progress: 0,
        isPaused: false
      });

      const { uploadId } = await initiateChunkedUpload(file.name, file.size, totalChunks, file.type);
      setChunkedUploadState(prev => ({ ...prev, uploadId }));

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        while (uploadStateRef.current.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!uploadStateRef.current.isUploading) break;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const { url } = await getUploadUrl(uploadId, chunkIndex);
        const etag = await uploadChunkToS3(chunk, url);
        await markChunkUploaded(uploadId, chunkIndex, etag);

        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        setChunkedUploadState(prev => ({
          ...prev,
          currentChunk: chunkIndex + 1,
          progress
        }));
      }

      if (uploadStateRef.current.isUploading) {
        await completeChunkedUpload(uploadId, file.name);
        setChunkedUploadState({
          uploadId: null,
          currentChunk: 0,
          totalChunks: 0,
          progress: 0,
          isPaused: false,
          isUploading: false,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Chunked upload failed:', error);
      toast.error('Upload failed');
      return false;
    } finally {
      setChunkedUploadState(prev => ({ ...prev, isUploading: false }));
    }
  }, [initiateChunkedUpload, getUploadUrl, uploadChunkToS3, markChunkUploaded, completeChunkedUpload]);

  const pauseChunkedUpload = useCallback(() => {
    setChunkedUploadState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeChunkedUpload = useCallback(() => {
    setChunkedUploadState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const cancelUpload = useCallback(async () => {
    setChunkedUploadState(prev => ({ ...prev, isUploading: false }));
    if (uploadStateRef.current.uploadId) {
      await cancelChunkedUpload(uploadStateRef.current.uploadId);
    }
    setChunkedUploadState({
      uploadId: null,
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
      isPaused: false,
      isUploading: false,
    });
  }, [cancelChunkedUpload]);

  return {
    starFile,
    trashFile,
    deleteFile,
    restoreFile,
    shareFile,
    removeSharedFile,
    uploadFile, // legacy small file upload
    uploadFileChunked, // multipart S3 upload
    refreshFiles,
    pauseChunkedUpload,
    resumeChunkedUpload,
    cancelUpload,
    chunkedUploadState,
  };
};
