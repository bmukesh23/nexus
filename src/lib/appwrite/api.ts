import { INewPost, INewUser, IUpdatePost } from "@/types";
import { ID, Query } from "appwrite";
import { account, appwriteConfig, avatars, databases, storage } from "./config";

export const createUserAccount = async (user: INewUser) => {
    try {
        const newAccount = await account.create(
            ID.unique(),
            user.email,
            user.password,
            user.name,
        )

        if (!newAccount) throw Error;

        const avatarUrl = avatars.getInitials(user.name);

        const newUser = await saveUserToDB({
            accountId: newAccount.$id,
            name: newAccount.name,
            email: newAccount.email,
            username: user.username,
            imageUrl: avatarUrl,
        })
        return newUser;
    } catch (error) {
        console.log(error);
        return error;
    }
}

export const saveUserToDB = async (user: {
    accountId: string;
    email: string;
    name: string;
    imageUrl: URL;
    username?: string;
}) => {
    const newUser = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        ID.unique(),
        user,
    )

    return newUser;
}

export const signInAccount = async (user: {
    email: string;
    password: string
}) => {
    try {
        const session = await account.createEmailSession(user.email, user.password);
        return session;
    } catch (error) {
        console.log(error);
    }
}

export const getCurrentUser = async () => {
    try {
        const currentAccount = await account.get();
        if (!currentAccount) throw Error;

        const currentUser = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)]
        );

        if (!currentUser) throw Error;

        return currentUser.documents[0];
    } catch (error) {
        console.log(error);
    }
}

export const signOutAccount = async () => {
    try {
        const session = await account.deleteSession("current");
        return session;
    } catch (error) {
        console.log(error);
    }
}

export const createPost = async (post: INewPost) => {
    try {
        // upload image to storage
        const uploadedFile = await uploadFile(post.file[0]);

        if (!uploadedFile) throw Error;

        // Get file url
        const fileUrl = getFilePreview(uploadedFile.$id);
        if (!fileUrl) {
            await deleteFile(uploadedFile.$id);
            throw Error;
        }

        // Convert tags in an array
        const tags = post.tags?.replace(/ /g, "").split(',') || [];

        const newPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            ID.unique(),
            {
                creator: post.userId,
                caption: post.caption,
                imageUrl: fileUrl,
                imageId: uploadedFile.$id,
                location: post.location,
                tags: tags,
            }
        )

        if (!newPost) {
            await deleteFile(uploadedFile.$id)
            throw Error;
        }

        return newPost;
    } catch (error) {
        console.log(error);
    }
}

export const uploadFile = async (file: File) => {
    try {
        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file,
        );
        return uploadedFile;
    } catch (error) {
        console.log(error);
    }
}

export const getFilePreview = (fileId: string) => {
    try {
        const fileUrl = storage.getFilePreview(
            appwriteConfig.storageId,
            fileId,
            2000,
            2000,
            "top",
            100,
        )

        return fileUrl;
    } catch (error) {
        console.log(error);
    }
}

export const deleteFile = async (fileId: string) => {
    try {
        await storage.deleteFile(appwriteConfig.storageId, fileId);
        return { status: 'ok' }
    } catch (error) {
        console.log(error);
    }
}

export const getRecentPosts = async () => {
    const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        [Query.orderDesc('$createdAt'), Query.limit(20)]
    )

    if (!posts) throw Error;

    return posts;
}

export const likePost = async (postId: string, likesArray: string[]) => {
    try {
        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
            {
                likes: likesArray,
            }
        )

        if (!updatedPost) throw Error;

        return updatedPost;
    } catch (error) {
        console.log(error)
    }
}

export const savePost = async (userId: string, postId: string) => {
    try {
        const updatedPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            ID.unique(),
            {
                user: userId,
                post: postId,
            }
        );

        if (!updatedPost) throw Error;

        return updatedPost;
    } catch (error) {
        console.log(error);
    }
}

export const deleteSavedPost = async (savedRecordId: string) => {
    try {
        const statusCode = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            savedRecordId,
        )

        if (!statusCode) throw Error;

        return { status: 'ok' };
    } catch (error) {
        console.log(error);
    }
}

export const getPostById = async (postId: string) => {
    try {
        const post = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
        )

        return post;
    } catch (error) {
        console.log(error);
    }
}

export const updatePost = async (post: IUpdatePost) => {
    const hasFileToUpdate = post.file.length > 0;

    try {
        let image = {
            imageUrl: post.imageUrl,
            imageId: post.imageId,
        }

        if (hasFileToUpdate) {
            // upload image to storage
            const uploadedFile = await uploadFile(post.file[0]);
            if (!uploadedFile) throw Error;

            // Get file url
            const fileUrl = getFilePreview(uploadedFile.$id);
            if (!fileUrl) {
                await deleteFile(uploadedFile.$id);
                throw Error;
            }

            image = {...image, imageUrl: fileUrl, imageId: uploadFile.$id}
        }

        // Convert tags in an array
        const tags = post.tags?.replace(/ /g, "").split(',') || [];

        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            post.postId,
            {
                caption: post.caption,
                imageUrl: image.imageUrl,
                imageId: image.imageId,
                location: post.location,
                tags: tags,
            }
        )

        if (!updatedPost) {
            await deleteFile(post.imageId)
            throw Error;
        }

        return updatePost;
    } catch (error) {
        console.log(error);
    }
}