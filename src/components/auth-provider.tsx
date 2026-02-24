"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { userService, UserProfile } from "@/lib/users";

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
    activateBeta: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    loginWithGoogle: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
    activateBeta: async () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
        // "Turbo Cache": Load profile from localStorage immediately to prevent flicker/loading
        if (typeof window !== "undefined") {
            const cached = localStorage.getItem("user_profile_cache");
            return cached ? JSON.parse(cached) : null;
        }
        return null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
            // Decouple user state from profile loading to prevent UI hang
            setUser(authUser);
            setLoading(false); // Stop pulsing as soon as we know if user is logged in or not

            if (authUser) {
                // Subscribe to profile changes immediately - this handles initial fetch AND real-time updates
                if (unsubscribeProfile) unsubscribeProfile();
                unsubscribeProfile = userService.subscribeToProfile(authUser.uid, async (p) => {
                    if (p) {
                        // Prevent "points disappearance": Don't overwrite if local state is already "better"
                        // unless the remote state is also positive.
                        setUserProfile(p);
                        localStorage.setItem("user_profile_cache", JSON.stringify(p));
                    } else if (!userProfile?.isBetaTester) {
                        // Only create/reset if we don't have a cached beta profile
                        try {
                            const newProfile = await userService.createUserProfile(authUser.uid, authUser.email || "");
                            setUserProfile(newProfile);
                            localStorage.setItem("user_profile_cache", JSON.stringify(newProfile));
                        } catch (err) {
                            console.error("Error creating profile:", err);
                        }
                    }
                });
            } else {
                setUserProfile(null);
                localStorage.removeItem("user_profile_cache");
                if (unsubscribeProfile) unsubscribeProfile();
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login with Google failed:", error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const signUpWithEmail = async (email: string, pass: string) => {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        await createUserWithEmailAndPassword(auth, email, pass);
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            localStorage.removeItem("user_profile_cache");
            setUserProfile(null);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const activateBeta = async (code: string) => {
        if (user) {
            const success = await userService.activateBeta(user.uid, code);
            // Optimistic update: grant access immediately instead of waiting for snapshot
            if (success) {
                const optimisticProfile = {
                    ...userProfile,
                    uid: user.uid,
                    email: user.email || "",
                    isBetaTester: true,
                    credits: 900
                };
                setUserProfile(optimisticProfile as UserProfile);
                localStorage.setItem("user_profile_cache", JSON.stringify(optimisticProfile));
            }
            return success;
        }
        return false;
    };

    return (
        <AuthContext.Provider value={{
            user,
            userProfile,
            loading,
            loginWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            logout,
            activateBeta
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
