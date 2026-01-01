package storage

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
)

type LocalStorageService struct {
	basePath    string
	baseURL     string
	allowedExts map[string]bool
}

func NewLocalStorageService(basePath, baseURL string) *LocalStorageService {
	// Create base directory
	os.MkdirAll(basePath, 0755)

	// Initialize allowed extensions
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
	}

	return &LocalStorageService{
		basePath:    basePath,
		baseURL:     baseURL,
		allowedExts: allowedExts,
	}
}

func (s *LocalStorageService) UploadFile(ctx context.Context, file multipart.File, header *multipart.FileHeader, folder string) (string, error) {
	// Get file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))

	// Check if extension is allowed
	if !s.allowedExts[ext] {
		return "", fmt.Errorf("file extension %s is not allowed", ext)
	}

	// Create folder directory
	folderPath := filepath.Join(s.basePath, folder)
	if err := os.MkdirAll(folderPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create folder: %v", err)
	}

	// Generate unique filename
	filename := fmt.Sprintf("%d%s", ctx.Value("timestamp").(int64), ext)
	filePath := filepath.Join(folderPath, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %v", err)
	}
	defer dst.Close()

	// Copy file content
	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to save file: %v", err)
	}

	// Return URL
	url := fmt.Sprintf("%s/uploads/%s/%s", s.baseURL, folder, filename)
	return url, nil
}

func (s *LocalStorageService) DeleteFile(ctx context.Context, key string) error {
	filePath := filepath.Join(s.basePath, key)
	return os.Remove(filePath)
}

func (s *LocalStorageService) GeneratePresignedURL(key string, expires int64) (string, error) {
	// For local storage, just return the URL
	return fmt.Sprintf("%s/uploads/%s", s.baseURL, key), nil
}
