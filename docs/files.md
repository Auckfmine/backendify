# File Storage

Backendify provides file storage capabilities for managing uploads, images, and documents in your applications.

---

## Overview

The file storage system allows you to:
- Upload files (images, documents, etc.)
- Organize files in folders
- Generate secure URLs for access
- Manage file metadata

---

## Uploading Files

### Via API

```bash
POST /api/projects/{project_id}/files
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary)
folder: "uploads/images"
```

**Response:**
```json
{
  "id": "file-uuid",
  "name": "image.jpg",
  "path": "uploads/images/image.jpg",
  "size": 102400,
  "mime_type": "image/jpeg",
  "url": "https://storage.backendify.io/project-id/uploads/images/image.jpg",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Listing Files

```bash
GET /api/projects/{project_id}/files?folder=uploads/images
Authorization: Bearer {token}
```

**Response:**
```json
{
  "files": [
    {
      "id": "file-uuid",
      "name": "image.jpg",
      "path": "uploads/images/image.jpg",
      "size": 102400,
      "mime_type": "image/jpeg"
    }
  ],
  "total": 1
}
```

---

## Downloading Files

```bash
GET /api/projects/{project_id}/files/{file_id}
Authorization: Bearer {token}
```

Returns the file binary with appropriate Content-Type header.

---

## Deleting Files

```bash
DELETE /api/projects/{project_id}/files/{file_id}
Authorization: Bearer {token}
```

---

## File Policies

Control who can upload and access files:

| Policy | Description |
|--------|-------------|
| `upload` | Who can upload files |
| `read` | Who can view/download files |
| `delete` | Who can delete files |

### Example: Authenticated Users Only

```json
{
  "action": "upload",
  "effect": "allow",
  "allowed_principals": ["app_user"],
  "require_email_verified": true
}
```

---

## Storage Limits

| Limit | Default |
|-------|---------|
| Max file size | 10 MB |
| Max files per project | 10,000 |
| Allowed file types | Configurable |

---

## Linking Files to Records

Store file references in your collections:

1. Create a `string` field for the file URL
2. Upload the file
3. Save the returned URL to your record

```javascript
// Upload file
const file = await uploadFile(projectId, imageFile);

// Create record with file reference
await createRecord(projectId, 'posts', {
  title: 'My Post',
  image_url: file.url
});
```

---

## Image Processing (Coming Soon)

Future features:
- Automatic thumbnail generation
- Image resizing
- Format conversion
- CDN integration

---

## Best Practices

1. **Validate file types** - Restrict uploads to expected types
2. **Set size limits** - Prevent oversized uploads
3. **Use folders** - Organize files logically
4. **Clean up unused files** - Delete files when records are deleted
5. **Use signed URLs** - For private file access
