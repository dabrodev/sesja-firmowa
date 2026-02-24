import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
    uid: string;
    isBetaTester: boolean;
    credits: number;
    email: string;
    createdAt?: any;
    pushToken?: string;
}

export const userService = {
    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error("Error getting user profile:", error);
            throw error;
        }
    },

    async createUserProfile(uid: string, email: string): Promise<UserProfile> {
        const { serverTimestamp } = await import("firebase/firestore");
        try {
            const profile: UserProfile = {
                uid,
                email,
                isBetaTester: false,
                credits: 0,
                createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, "users", uid), profile);
            return profile;
        } catch (error) {
            console.error("Error creating user profile:", error);
            throw error;
        }
    },

    async activateBeta(uid: string, code: string): Promise<boolean> {
        const betaCode = process.env.NEXT_PUBLIC_BETA_CODE;
        if (betaCode && code.toLowerCase() === betaCode.toLowerCase()) {
            try {
                const docRef = doc(db, "users", uid);
                // Standard await to ensure consistency, optimistic UI in AuthProvider handles speed
                await setDoc(docRef, {
                    isBetaTester: true,
                    credits: 900,
                }, { merge: true });
                return true;
            } catch (error) {
                console.error("Error activating beta:", error);
                throw error;
            }
        }
        return false;
    },

    async deductCredits(uid: string, amount: number): Promise<void> {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const profile = docSnap.data() as UserProfile;
                const newCredits = Math.max(0, profile.credits - amount);
                await setDoc(docRef, { credits: newCredits }, { merge: true });
            }
        } catch (error) {
            console.error("Error deducting credits:", error);
            throw error;
        }
    },

    async updatePushToken(uid: string, pushToken: string): Promise<void> {
        try {
            const docRef = doc(db, "users", uid);
            await updateDoc(docRef, { pushToken });
        } catch (error) {
            console.error("Error updating push token:", error);
            throw error;
        }
    },

    subscribeToProfile(uid: string, callback: (profile: UserProfile | null) => void) {
        return onSnapshot(doc(db, "users", uid), (doc) => {
            if (doc.exists()) {
                callback(doc.data() as UserProfile);
            } else {
                callback(null);
            }
        });
    }
};
