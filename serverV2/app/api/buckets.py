"""
API routes for bucket operations.

This module defines the FastAPI endpoints for creating and managing buckets,
which are used to organize and control access to buffers.
"""

from fastapi import APIRouter, Depends, status
from typing import List, Dict, Any

from app.utils.auth import get_current_user
from app.utils.errors import NotFoundError, PermissionError, handle_recall_error
from app.models.bucket import BucketCreate, BucketResponse, BucketMemberAdd, BucketMemberResponse
from app.logging_config import get_logger
from app.db import get_supabase_client

router = APIRouter(prefix="/buckets", tags=["buckets"])
logger = get_logger(__name__)


@router.post("/", response_model=BucketResponse, status_code=status.HTTP_201_CREATED)
async def create_bucket(bucket: BucketCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Create a new bucket/group.

    - **name**: Name of the bucket
    - **description**: Optional description of the bucket

    Returns the created bucket with its ID and metadata.
    """
    try:
        supabase = get_supabase_client()

        import uuid
        from datetime import datetime

        bucket_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        result = (
            supabase.table("buckets")
            .insert(
                {
                    "id": bucket_id,
                    "name": bucket.name,
                    "description": bucket.description,
                    "created_at": now,
                    "created_by": user.id,
                }
            )
            .execute()
        )

        if not result.data:
            raise Exception("Failed to create bucket")

        # Creator automatically becomes an admin member
        supabase.table("bucket_members").insert(
            {"bucket_id": bucket_id, "user_id": user.id, "role": "admin"}
        ).execute()

        return result.data[0]

    except Exception as e:
        logger.exception(f"Error creating bucket: {str(e)}")
        raise handle_recall_error(e)


@router.get("/", response_model=List[BucketResponse])
async def list_buckets(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    List all buckets the user has access to.

    Returns a list of buckets.
    """
    try:
        supabase = get_supabase_client()

        # Instead of using execute_raw, use the PostgreSQL functions feature
        # or multiple queries combined

        # First get buckets created by the user
        user_buckets = (
            supabase.table("buckets")
            .select("*")
            .eq("created_by", user.id)
            .execute()
        )
        
        # Then get buckets where user is a member
        member_bucket_ids = (
            supabase.table("bucket_members")
            .select("bucket_id")
            .eq("user_id", user.id)
            .execute()
        )
        
        # If user is a member of any buckets, get those buckets
        member_buckets_data = []
        if member_bucket_ids.data:
            bucket_ids = [item["bucket_id"] for item in member_bucket_ids.data]
            
            # Query each bucket individually or use an RPC function
            for bucket_id in bucket_ids:
                bucket = (
                    supabase.table("buckets")
                    .select("*")
                    .eq("id", bucket_id)
                    .execute()
                )
                if bucket.data:
                    member_buckets_data.extend(bucket.data)
        
        # Combine results, removing duplicates
        all_buckets = {}
        for bucket in user_buckets.data:
            all_buckets[bucket["id"]] = bucket
            
        for bucket in member_buckets_data:
            if bucket["id"] not in all_buckets:
                all_buckets[bucket["id"]] = bucket
                
        return list(all_buckets.values())

    except Exception as e:
        logger.exception(f"Error listing buckets: {str(e)}")
        raise handle_recall_error(e)


@router.get("/{bucket_id}", response_model=BucketResponse)
async def get_bucket(bucket_id: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get a bucket by its ID.

    - **bucket_id**: ID of the bucket to retrieve

    Returns the bucket with its metadata.
    """
    try:
        supabase = get_supabase_client()

        # Check if bucket exists and user has access
        bucket = supabase.table("buckets").select("*").eq("id", bucket_id).execute()

        if not bucket.data:
            raise NotFoundError(f"Bucket with ID {bucket_id} not found")

        bucket_data = bucket.data[0]

        # Check if user has access
        if bucket_data["created_by"] != user.id:
            # Check if user is a member
            member = (
                supabase.table("bucket_members")
                .select("*")
                .eq("bucket_id", bucket_id)
                .eq("user_id", user.id)
                .execute()
            )

            if not member.data:
                raise PermissionError("You do not have access to this bucket")

        return bucket_data

    except (NotFoundError, PermissionError) as e:
        logger.warning(f"Bucket access error: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error retrieving bucket: {str(e)}")
        raise handle_recall_error(e)


@router.post("/{bucket_id}/members", response_model=Dict[str, str])
async def add_bucket_member(
    bucket_id: str, member: BucketMemberAdd, user=Depends(get_current_user)
) -> Dict[str, str]:
    """
    Add a member to a bucket.

    - **bucket_id**: ID of the bucket to add a member to
    - **user_email**: Email of the user to add
    - **role**: Role of the user in the bucket (default: member)

    Returns a success message.
    """
    try:
        supabase = get_supabase_client()

        # Check if bucket exists
        bucket = supabase.table("buckets").select("*").eq("id", bucket_id).execute()

        if not bucket.data:
            raise NotFoundError(f"Bucket with ID {bucket_id} not found")

        # Check if user is admin
        user_role = None
        if bucket.data[0]["created_by"] == user.id:
            user_role = "admin"
        else:
            member_info = (
                supabase.table("bucket_members")
                .select("role")
                .eq("bucket_id", bucket_id)
                .eq("user_id", user.id)
                .execute()
            )

            if member_info.data:
                user_role = member_info.data[0]["role"]

        if user_role != "admin":
            raise PermissionError("Only bucket admins can add members")

        # Find user by email
        try:
            # Try using RPC function if available
            new_member = supabase.rpc(
                "get_user_id_by_email", 
                {"email_param": member.user_email}
            ).execute()
            
            if not new_member.data or len(new_member.data) == 0:
                raise NotFoundError(f"User with email {member.user_email} not found")
                
            new_member_id = new_member.data[0]["id"]
        except Exception as e:
            logger.error(f"Error finding user by email: {str(e)}")
            # Fallback method
            new_member = supabase.table("users").select("id").eq("email", member.user_email).execute()
            
            if not new_member.data:
                raise NotFoundError(f"User with email {member.user_email} not found")
                
            new_member_id = new_member.data[0]["id"]

        # Check if already a member
        existing = (
            supabase.table("bucket_members")
            .select("*")
            .eq("bucket_id", bucket_id)
            .eq("user_id", new_member_id)
            .execute()
        )

        if existing.data:
            return {"message": "User is already a member of this bucket"}

        # Add member - now including the email field
        supabase.table("bucket_members").insert(
            {
                "bucket_id": bucket_id, 
                "user_id": new_member_id, 
                "role": member.role,
                "user_email": member.user_email  # Store the email directly
            }
        ).execute()

        return {"message": "Member added successfully"}

    except (NotFoundError, PermissionError) as e:
        logger.warning(f"Error adding bucket member: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error adding bucket member: {str(e)}")
        raise handle_recall_error(e)


@router.get("/{bucket_id}/members", response_model=List[BucketMemberResponse])
async def list_bucket_members(
    bucket_id: str, user=Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    List all members of a bucket.

    - **bucket_id**: ID of the bucket to list members for

    Returns a list of bucket members.
    """
    try:
        supabase = get_supabase_client()

        # Check if bucket exists and user has access
        bucket = supabase.table("buckets").select("*").eq("id", bucket_id).execute()

        if not bucket.data:
            raise NotFoundError(f"Bucket with ID {bucket_id} not found")

        # Check if user has access
        if bucket.data[0]["created_by"] != user.id:
            # Check if user is a member
            member = (
                supabase.table("bucket_members")
                .select("*")
                .eq("bucket_id", bucket_id)
                .eq("user_id", user.id)
                .execute()
            )

            if not member.data:
                raise PermissionError("You do not have access to this bucket")

        # Now we can just fetch the bucket members directly, since the email is stored
        members = (
            supabase.table("bucket_members")
            .select("*")
            .eq("bucket_id", bucket_id)
            .execute()
        )
        
        return members.data

    except (NotFoundError, PermissionError) as e:
        logger.warning(f"Error listing bucket members: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error listing bucket members: {str(e)}")
        raise handle_recall_error(e)


@router.delete("/{bucket_id}/members/{user_id}", response_model=Dict[str, str])
async def remove_bucket_member(
    bucket_id: str, member_user_id: str, user=Depends(get_current_user)
) -> Dict[str, str]:
    """
    Remove a member from a bucket.

    - **bucket_id**: ID of the bucket to remove a member from
    - **member_user_id**: ID of the user to remove

    Returns a success message.
    """
    try:
        supabase = get_supabase_client()

        # Check if bucket exists
        bucket = supabase.table("buckets").select("*").eq("id", bucket_id).execute()

        if not bucket.data:
            raise NotFoundError(f"Bucket with ID {bucket_id} not found")

        # Check if user is admin
        user_role = None
        if bucket.data[0]["created_by"] == user.id:
            user_role = "admin"
        else:
            member_info = (
                supabase.table("bucket_members")
                .select("role")
                .eq("bucket_id", bucket_id)
                .eq("user_id", user.id)
                .execute()
            )

            if member_info.data:
                user_role = member_info.data[0]["role"]

        if user_role != "admin":
            raise PermissionError("Only bucket admins can remove members")

        # Prevent removing the bucket creator
        if member_user_id == bucket.data[0]["created_by"]:
            raise PermissionError("Cannot remove the bucket creator")

        # Check if the member exists
        member = (
            supabase.table("bucket_members")
            .select("*")
            .eq("bucket_id", bucket_id)
            .eq("user_id", member_user_id)
            .execute()
        )

        if not member.data:
            raise NotFoundError(f"User is not a member of this bucket")

        # Remove member
        supabase.table("bucket_members").delete().eq("bucket_id", bucket_id).eq(
            "user_id", member_user_id
        ).execute()

        return {"message": "Member removed successfully"}

    except (NotFoundError, PermissionError) as e:
        logger.warning(f"Error removing bucket member: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error removing bucket member: {str(e)}")
        raise handle_recall_error(e)
