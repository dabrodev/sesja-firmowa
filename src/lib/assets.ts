import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { AssetType, PhotoAsset } from "./store";
import { extractR2KeyFromReference } from "./reference-assets";

export interface UserAsset extends PhotoAsset {
    docId: string;
    userId: string;
    type: AssetType;
    createdAt: Timestamp;
    generationPrompt?: string;
}

interface SaveAssetOptions {
    generationPrompt?: string;
}

export const assetService = {
    async saveAsset(userId: string, asset: PhotoAsset, type: AssetType, options?: SaveAssetOptions) {
        try {
            // Check if asset with this ID already exists for this user
            const q = query(
                collection(db, "user_assets"),
                where("userId", "==", userId),
                where("id", "==", asset.id)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                if (
                    options?.generationPrompt &&
                    typeof existingDoc.data().generationPrompt !== "string"
                ) {
                    await updateDoc(existingDoc.ref, {
                        generationPrompt: options.generationPrompt,
                    });
                }
                return existingDoc.id; // Already saved
            }

            const docRef = await addDoc(collection(db, "user_assets"), {
                ...asset,
                userId,
                type,
                ...(options?.generationPrompt ? { generationPrompt: options.generationPrompt } : {}),
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving user asset:", error);
            throw error;
        }
    },

    async getUserAssets(userId: string, type: AssetType): Promise<UserAsset[]> {
        try {
            const q = query(
                collection(db, "user_assets"),
                where("userId", "==", userId),
                where("type", "==", type)
            );
            // using local sort to avoid requiring a composite index right away
            const querySnapshot = await getDocs(q);
            const assets = querySnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    docId: doc.id,
                    id: typeof data.id === "string" ? data.id : doc.id,
                    url: typeof data.url === "string" ? data.url : "",
                    name: typeof data.name === "string" ? data.name : "asset",
                    size: typeof data.size === "number" ? data.size : 0,
                    userId: typeof data.userId === "string" ? data.userId : userId,
                    type:
                        data.type === "face" ||
                        data.type === "office" ||
                        data.type === "outfit" ||
                        data.type === "generated"
                            ? data.type
                            : type,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromMillis(0),
                    generationPrompt:
                        typeof data.generationPrompt === "string" && data.generationPrompt.trim().length > 0
                            ? data.generationPrompt
                            : undefined,
                } as UserAsset;
            });

            return assets.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA; // newest first
            });
        } catch (error) {
            console.error("Error getting user assets:", error);
            throw error;
        }
    },

    async getAllUserAssets(userId: string): Promise<UserAsset[]> {
        const [faceAssets, officeAssets, outfitAssets, generatedAssets] = await Promise.all([
            this.getUserAssets(userId, "face"),
            this.getUserAssets(userId, "office"),
            this.getUserAssets(userId, "outfit"),
            this.getUserAssets(userId, "generated"),
        ]);

        return [...faceAssets, ...officeAssets, ...outfitAssets, ...generatedAssets].sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        });
    },

    async hasUserAssetReference(userId: string, assetReference: string): Promise<boolean> {
        try {
            const key = extractR2KeyFromReference(assetReference);

            if (key) {
                const keyQuery = query(
                    collection(db, "user_assets"),
                    where("userId", "==", userId),
                    where("id", "==", key)
                );
                const keySnapshot = await getDocs(keyQuery);
                if (!keySnapshot.empty) {
                    return true;
                }
            }

            const referenceQuery = query(
                collection(db, "user_assets"),
                where("userId", "==", userId),
                where("url", "==", assetReference)
            );
            const referenceSnapshot = await getDocs(referenceQuery);
            return !referenceSnapshot.empty;
        } catch (error) {
            console.error("Error checking user asset reference:", error);
            throw error;
        }
    },

    async deleteAsset(docId: string, assetReference?: string) {
        try {
            const key = assetReference ? extractR2KeyFromReference(assetReference) : null;

            // Remove the physical file from R2 first (gallery assets live under uploads/*).
            if (key && key.startsWith("uploads/")) {
                const response = await fetch("/api/delete-file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key }),
                });

                if (!response.ok) {
                    let errorMessage = "Nie udało się usunąć pliku z chmury.";
                    try {
                        const data = await response.json() as { error?: string };
                        if (data.error) errorMessage = data.error;
                    } catch {
                        // ignore JSON parse failures
                    }
                    throw new Error(errorMessage);
                }
            }

            await deleteDoc(doc(db, "user_assets", docId));
        } catch (error) {
            console.error("Error deleting user asset:", error);
            throw error;
        }
    }
};
