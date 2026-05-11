// Package service provides MinIO object storage client for file uploads.
package service

import (
	"context"
	"fmt"
	"os"
	"path"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIOClient wraps the MinIO SDK client for file operations.
type MinIOClient struct {
	client *minio.Client
	bucket string
}

// NewMinIOClient creates a new MinIO client from environment variables.
func NewMinIOClient() (*MinIOClient, error) {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "echoes-minio:9000"
	}
	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	if accessKey == "" {
		accessKey = "echoes_minio"
	}
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	if secretKey == "" {
		secretKey = "echoes_minio_secret"
	}
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "echoes-files"
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	// Ensure bucket exists
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return &MinIOClient{
		client: client,
		bucket: bucket,
	}, nil
}

// UploadFile uploads a file to MinIO and returns the object URL.
func (m *MinIOClient) UploadFile(ctx context.Context, objectName string, filePath string, contentType string) (string, error) {
	_, err := m.client.FPutObject(ctx, m.bucket, objectName, filePath, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file to MinIO: %w", err)
	}

	return fmt.Sprintf("http://%s/%s/%s", m.client.EndpointURL().Host, m.bucket, objectName), nil
}

// GetPresignedGetURL generates a presigned URL for downloading a file.
func (m *MinIOClient) GetPresignedGetURL(ctx context.Context, objectName string) (string, error) {
	url, err := m.client.PresignedGetObject(ctx, m.bucket, objectName, 300*time.Second, nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}
	return url.String(), nil
}

// BuildObjectPath constructs the MinIO object path for a memory file.
func BuildObjectPath(userID string, memoryID string, fileName string) string {
	return path.Join("files", userID, memoryID, fileName)
}
