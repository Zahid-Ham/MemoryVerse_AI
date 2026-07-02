import cloudinary
import cloudinary.uploader
import os

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET
    )

class CloudinaryService:
    @staticmethod
    def upload_file(file_path: str, filename: str) -> str:
        """
        Uploads a local file to Cloudinary and returns the secure URL.
        """
        if not CLOUDINARY_CLOUD_NAME:
            print("Warning: CLOUDINARY_URL is not configured. Skipping Cloudinary upload.")
            return ""

        try:
            # Determine correct resource type to ensure documents aren't uploaded as images
            ext = filename.lower().split(".")[-1]
            if ext in ["pdf", "docx", "doc", "txt"]:
                res_type = "raw"
            elif ext in ["png", "jpg", "jpeg", "webp", "gif"]:
                res_type = "image"
            else:
                res_type = "auto"

            safe_filename = "".join([c if c.isalnum() else "_" for c in filename.split(".")[0]])
            from datetime import datetime
            timestamp = int(datetime.utcnow().timestamp())
            
            # Explicitly append extension for raw resources so Cloudinary URL retains it
            if res_type == "raw":
                final_public_id = f"{safe_filename}_{timestamp}.{ext}"
            else:
                final_public_id = f"{safe_filename}_{timestamp}"

            print(f"[CLOUDINARY] Uploading {filename} to Cloudinary as {res_type}...", flush=True)

            with open(file_path, "rb") as f:
                file_bytes = f.read()

            response = cloudinary.uploader.upload(
                file_bytes,
                folder="memoryverse/attachments",
                public_id=final_public_id,
                resource_type=res_type,
                access_mode="public",
                type="upload",
                overwrite=True,
                invalidate=True
            )

            print(f"[CLOUDINARY] Upload response: {response}", flush=True)
            return response.get("secure_url", "")
        except Exception as e:
            print(f"Error uploading to Cloudinary: {e}", flush=True)
            return ""

    @staticmethod
    def delete_file(cloudinary_url: str) -> bool:
        """
        Removes a file from Cloudinary based on its secure URL.
        """
        if not CLOUDINARY_CLOUD_NAME or not cloudinary_url or "cloudinary.com" not in cloudinary_url:
            return False

        try:
            # Extract public ID from the secure url: /upload/.../folder/public_id.ext
            # Example: https://res.cloudinary.com/cloud_name/image/upload/v1234/folder/id.pdf
            url_parts = cloudinary_url.split("/upload/")
            if len(url_parts) < 2:
                return False
            
            # parts after '/upload/' (e.g. 'v1234/folder/id.pdf')
            path_parts = url_parts[1].split("/")
            if len(path_parts) < 2:
                return False
            
            # Remove version part (starts with 'v')
            if path_parts[0].startswith("v"):
                path_parts = path_parts[1:]
                
            # Combine back and drop file extension
            public_path = "/".join(path_parts)
            public_id = public_path.rsplit(".", 1)[0]
            
            print(f"[CLOUDINARY] Deleting resource {public_id} from Cloudinary...", flush=True)
            
            # Since document format can be raw (like pdf, docx), check if it needs specific resource_type
            # We can run destroy on image/video/raw
            for res_type in ["image", "raw", "video"]:
                result = cloudinary.uploader.destroy(public_id, resource_type=res_type)
                if result.get("result") == "ok":
                    print(f"[CLOUDINARY] Successfully deleted {public_id} as {res_type}", flush=True)
                    return True
            return False
        except Exception as e:
            print(f"Error deleting from Cloudinary: {e}", flush=True)
            return False

    @staticmethod
    def get_signed_url(cloudinary_url: str) -> str:
        """
        Generates a signed download URL using API credentials to bypass public CDN blocks.
        """
        if not CLOUDINARY_CLOUD_NAME or not cloudinary_url or "cloudinary.com" not in cloudinary_url:
            return cloudinary_url
        try:
            # Extract public ID and extension from the secure url
            url_parts = cloudinary_url.split("/upload/")
            if len(url_parts) < 2:
                return cloudinary_url
            
            path_parts = url_parts[1].split("/")
            if len(path_parts) < 2:
                return cloudinary_url
            
            # Remove version prefix if present
            if path_parts[0].startswith("v"):
                path_parts = path_parts[1:]
                
            public_path = "/".join(path_parts)
            extension = public_path.rsplit(".", 1)[-1]
            
            # Determine resource type (raw or image)
            if extension.lower() in ["pdf", "docx", "doc", "txt"]:
                r_type = "raw"
            elif extension.lower() in ["png", "jpg", "jpeg", "webp", "gif"]:
                r_type = "image"
            else:
                r_type = "auto"
                
            # For raw files, the extension is part of the public_id itself
            if r_type == "raw":
                public_id = public_path
            else:
                public_id = public_path.rsplit(".", 1)[0]
                
            import time
            import cloudinary.utils
            
            signed_url = cloudinary.utils.private_download_url(
                public_id,
                extension,
                resource_type=r_type,
                type="upload",
                expires_at=int(time.time()) + 3600,
                attachment=False
            )
            print(f"[CLOUDINARY] Generated signed URL: {signed_url[:100]}...", flush=True)
            return signed_url
        except Exception as e:
            print(f"Error generating signed URL: {e}", flush=True)
            return cloudinary_url
