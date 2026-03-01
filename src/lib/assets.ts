import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { PhotoAsset } from "./store";

export interface UserAsset extends PhotoAsset {
    userId: string;
    type: "face" | "office";
    createdAt: Timestamp;
}

export const assetService = {
    async saveAsset(userId: string, asset: PhotoAsset, type: "face" | "office") {
        try {
            // Check if asset with this ID already exists for this user
            const q = query(
                collection(db, "user_assets"),
                where("userId", "==", userId),
                where("id", "==", asset.id)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                return snapshot.docs[0].id; // Already saved
            }

            const docRef = await addDoc(collection(db, "user_assets"), {
                ...asset,
                userId,
                type,
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving user asset:", error);
            throw error;
        }
    },

    async getUserAssets(userId: string, type: "face" | "office"): Promise<UserAsset[]> {
        try {
            const q = query(
                collection(db, "user_assets"),
                where("userId", "==", userId),
                where("type", "==", type)
            );
            // using local sort to avoid requiring a composite index right away
            const querySnapshot = await getDocs(q);
            const assets = querySnapshot.docs.map(doc => ({
                docId: doc.id,
                ...doc.data()
            })) as (UserAsset & { docId: string })[];

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

    async deleteAsset(docId: string) {
        try {
            await deleteDoc(doc(db, "user_assets", docId));
        } catch (error) {
            console.error("Error deleting user asset:", error);
            throw error;
        }
    }
};
